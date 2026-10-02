import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { searchDrift } from '../cosmos/derive/drift.js';
import type { BlastResult, CosmosView, DriftEntry, DriftLinks, OnCall, ResolvedOwner, Step } from '../cosmos/types.js';

export const GET_SERVICE_TOOL_NAME = 'get_service';
export const GET_STEPS_TOOL_NAME = 'get_steps';
export const BLAST_RADIUS_TOOL_NAME = 'blast_radius';
export const WHO_OWNS_TOOL_NAME = 'who_owns';
export const ON_CALL_TOOL_NAME = 'on_call';
export const DRIFT_TOOL_NAME = 'drift';

function toOwnerSummary(owner: ResolvedOwner) {
  return {
    teamId: owner.teamId ?? null,
    label: owner.label,
    reviewers: owner.reviewers,
    githubTeam: owner.githubTeam ?? null,
    slack: owner.slack ?? null,
  };
}

export function getService(view: CosmosView, serviceId: string) {
  const service = view.data.services.find((candidate) => candidate.id === serviceId);
  if (!service) return null;
  return {
    id: service.id,
    name: service.name,
    role: service.role,
    sub: service.sub,
    desc: service.desc,
    lang: service.lang,
    tech: service.tech,
    repo: service.repo ?? null,
    subServices: (service.subServices ?? []).map(({ id, name, role, desc }) => ({ id, name, role, desc })),
    owner: toOwnerSummary(view.derived.ownership.byService[service.id]),
    links: view.derived.serviceLinks[service.id],
    health: view.derived.healthStatus.byService[service.id] ?? null,
    latestDriftKind: view.derived.latestDrift.byNode[service.id] ?? null,
  };
}

/** The ordered steps of a scenario or incident, payloads included. */
export function getSteps(view: CosmosView, playableId: string): Step[] | null {
  return view.derived.playable.stepsById[playableId] ?? null;
}

export function getBlastRadius(view: CosmosView, nodeId: string): BlastResult | null {
  return view.derived.blastRadius[nodeId] ?? null;
}

/** A topic has no team of its own, so it resolves to the owners of the services that publish it. */
export function whoOwns(view: CosmosView, nodeId: string) {
  const owner = view.derived.ownership.byService[nodeId];
  if (owner) return { serviceId: nodeId, owner: toOwnerSummary(owner) };
  const topicLinks = view.derived.topicLinks[nodeId];
  if (!topicLinks) return null;
  return {
    topicId: nodeId,
    producers: topicLinks.producers.map((serviceId) => ({
      serviceId,
      owner: toOwnerSummary(view.derived.ownership.byService[serviceId]),
    })),
  };
}

export interface OnCallAnswer {
  serviceId: string;
  teamId: string | null;
  teamLabel: string;
  onCall: OnCall | null;
}

export function getOnCall(view: CosmosView, serviceId: string): OnCallAnswer | null {
  const health = view.derived.healthStatus.byService[serviceId];
  if (health) return { serviceId, teamId: health.team, teamLabel: health.teamLabel, onCall: health.onCall };
  const service = view.data.services.find((candidate) => candidate.id === serviceId);
  if (!service) return null;
  return {
    serviceId,
    teamId: service.team ?? null,
    teamLabel: view.derived.ownership.byService[serviceId].label,
    onCall: service.team ? view.data.health.onCallByTeam[service.team] : null,
  };
}

export interface DriftQuery {
  query?: string;
  /** ISO date or datetime; entries from runs on or after its date. */
  since?: string;
}

/** Newest run first, matching the changelog's order. */
export function findDrift(view: CosmosView, { query = '', since }: DriftQuery): (DriftEntry & DriftLinks)[] {
  const sinceDate = since?.slice(0, 10);
  return searchDrift(view.data.drift.entries, view.derived.driftSearchText, query)
    .filter((entry) => !sinceDate || entry.date >= sinceDate)
    .map((entry) => ({ ...entry, ...view.derived.driftLinks[entry.id] }));
}

function toToolResult(value: unknown, notFound: string): string {
  return value === null ? notFound : JSON.stringify(value);
}

/** Read-only tools over the view: details the digest leaves out (payloads, blast radius, on-call, drift history). */
export function createReadTools(view: CosmosView) {
  const getServiceTool = tool(
    ({ serviceId }) => toToolResult(getService(view, serviceId), `No service "${serviceId}" exists on the map.`),
    {
      name: GET_SERVICE_TOOL_NAME,
      description: 'Full details of one service: description, sub-services, owner, links, health and latest drift.',
      schema: z.object({ serviceId: z.string().describe('A service id exactly as listed under "Services".') }),
    },
  );

  const getStepsTool = tool(
    ({ playableId }) =>
      toToolResult(getSteps(view, playableId), `No scenario or incident "${playableId}" exists on the map.`),
    {
      name: GET_STEPS_TOOL_NAME,
      description:
        'Ordered steps of a scenario or incident, including each request/response or event payload. ' +
        'Use it for questions about request bodies, payloads or exact messages.',
      schema: z.object({ playableId: z.string().describe('A scenario or incident id exactly as listed in the map data.') }),
    },
  );

  const blastRadiusTool = tool(
    ({ nodeId }) => toToolResult(getBlastRadius(view, nodeId), `No service or topic "${nodeId}" exists on the map.`),
    {
      name: BLAST_RADIUS_TOOL_NAME,
      description:
        'What breaks if a service or topic goes down or changes: every dependent with its hop distance and severity.',
      schema: z.object({ nodeId: z.string().describe('A service or topic id.') }),
    },
  );

  const whoOwnsTool = tool(
    ({ nodeId }) => toToolResult(whoOwns(view, nodeId), `No service or topic "${nodeId}" exists on the map.`),
    {
      name: WHO_OWNS_TOOL_NAME,
      description: 'The owning team, reviewers, GitHub team and Slack channel of a service (or of the producers of a topic).',
      schema: z.object({ nodeId: z.string().describe('A service or topic id.') }),
    },
  );

  const onCallTool = tool(
    ({ serviceId }) => toToolResult(getOnCall(view, serviceId), `No service "${serviceId}" exists on the map.`),
    {
      name: ON_CALL_TOOL_NAME,
      description: "Who is on call for a service's team right now (as of the data's date), until when, and where to reach them.",
      schema: z.object({ serviceId: z.string().describe('A service id.') }),
    },
  );

  const driftTool = tool(({ query, since }) => JSON.stringify(findDrift(view, { query, since })), {
    name: DRIFT_TOOL_NAME,
    description:
      'Changelog of drift the nightly sync found between the code and the map, newest first. ' +
      '`query` is one case-insensitive substring matched against title, detail, team id, PR, repo, kind and tags ' +
      '(e.g. "fulfillment", "payments", "kafka"); `since` keeps runs on or after an ISO date.',
    schema: z.object({
      query: z.string().optional().describe('One keyword; omit for every entry.'),
      since: z.string().optional().describe('ISO date (YYYY-MM-DD), counted from the data\'s "As of" date.'),
    }),
  });

  return [getServiceTool, getStepsTool, blastRadiusTool, whoOwnsTool, onCallTool, driftTool];
}
