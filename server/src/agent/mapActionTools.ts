import { tool, type ToolRunnableConfig } from '@langchain/core/tools';
import { getWriter } from '@langchain/langgraph';
import { z } from 'zod';
import type { CosmosView } from '../cosmos/types.js';

export const HIGHLIGHT_SERVICES_TOOL_NAME = 'highlight_services';
export const PLAY_SCENARIO_TOOL_NAME = 'play_scenario';
export const SHOW_BLAST_RADIUS_TOOL_NAME = 'show_blast_radius';
export const OPEN_PASSPORT_TOOL_NAME = 'open_passport';
export const SHOW_HEALTH_TOOL_NAME = 'show_health';
export const SHOW_OWNERSHIP_TOOL_NAME = 'show_ownership';
export const OPEN_CHANGELOG_ENTRY_TOOL_NAME = 'open_changelog_entry';

export type MapActionEvent =
  | { type: 'action'; kind: 'highlight'; serviceIds: string[] }
  | { type: 'action'; kind: 'playScenario'; scenarioId: string }
  | { type: 'action'; kind: 'showBlastRadius'; nodeId: string }
  | { type: 'action'; kind: 'openPassport'; nodeId: string }
  | { type: 'action'; kind: 'showHealth' }
  | { type: 'action'; kind: 'showOwnership' }
  | { type: 'action'; kind: 'openChangelogEntry'; entryId: string };

const MAP_ACTION_KINDS: ReadonlySet<string> = new Set<MapActionEvent['kind']>([
  'highlight',
  'playScenario',
  'showBlastRadius',
  'openPassport',
  'showHealth',
  'showOwnership',
  'openChangelogEntry',
]);

const HighlightServicesInputSchema = z.object({
  serviceIds: z.array(z.string()).describe('Service ids exactly as listed under "Services" in the map data.'),
});

const PlayScenarioInputSchema = z.object({
  scenarioId: z.string().describe('A scenario or incident id exactly as listed in the map data.'),
});

const NodeInputSchema = z.object({
  nodeId: z.string().describe('A service or topic id exactly as listed in the map data.'),
});

const NoInputSchema = z.object({});

const ChangelogEntryInputSchema = z.object({
  entryId: z.string().describe('A drift entry id, as listed under "Latest drift run" or returned by `drift`.'),
});

// z.enum needs a non-empty tuple; an empty map simply accepts nothing.
function knownIdSchema(ids: readonly string[]) {
  const [firstId, ...otherIds] = ids;
  return firstId === undefined ? z.never() : z.enum([firstId, ...otherIds]);
}

function emitMapAction(config: ToolRunnableConfig, event: MapActionEvent): void {
  getWriter(config)?.(event);
}

export function isMapActionEvent(value: unknown): value is MapActionEvent {
  if (typeof value !== 'object' || value === null) return false;
  const event = value as Record<string, unknown>;
  return event.type === 'action' && typeof event.kind === 'string' && MAP_ACTION_KINDS.has(event.kind);
}

/** The map-action tools; each drops ids the view doesn't know and only emits an action for known ones. */
export function createMapActionTools({ data }: CosmosView) {
  const serviceIds = data.services.map((service) => service.id);
  const KnownServiceIdSchema = knownIdSchema(serviceIds);
  // Incidents are playable too, matching decideRoute's direct-action targets.
  const KnownPlayableIdSchema = knownIdSchema([...data.scenarios, ...data.incidents].map((playable) => playable.id));
  const KnownNodeIdSchema = knownIdSchema([...serviceIds, ...data.topics.map((topic) => topic.id)]);
  const KnownDriftEntryIdSchema = knownIdSchema(data.drift.entries.map((entry) => entry.id));

  const highlightServices = tool(
    ({ serviceIds: requestedServiceIds }, config) => {
      const knownServiceIds = [...new Set(requestedServiceIds)].filter(
        (serviceId) => KnownServiceIdSchema.safeParse(serviceId).success,
      );
      const droppedServiceIds = requestedServiceIds.filter((serviceId) => !knownServiceIds.includes(serviceId));
      const droppedNote =
        droppedServiceIds.length > 0 ? ` Not on the map, ignored: ${droppedServiceIds.join(', ')}.` : '';
      if (knownServiceIds.length === 0) {
        return `Nothing highlighted.${droppedNote}`;
      }
      emitMapAction(config, { type: 'action', kind: 'highlight', serviceIds: knownServiceIds });
      return `Highlighted ${knownServiceIds.join(', ')} on the map.${droppedNote}`;
    },
    {
      name: HIGHLIGHT_SERVICES_TOOL_NAME,
      description: 'Highlight services on the map for the visitor. Call it whenever the answer names specific services.',
      schema: HighlightServicesInputSchema,
    },
  );

  const playScenario = tool(
    ({ scenarioId }, config) => {
      if (!KnownPlayableIdSchema.safeParse(scenarioId).success) {
        return `No scenario "${scenarioId}" exists on the map; nothing was played.`;
      }
      emitMapAction(config, { type: 'action', kind: 'playScenario', scenarioId });
      return `Started playing ${scenarioId} on the map.`;
    },
    {
      name: PLAY_SCENARIO_TOOL_NAME,
      description: 'Play a scenario or incident flow on the map when seeing it would help the visitor.',
      schema: PlayScenarioInputSchema,
    },
  );

  const showBlastRadius = tool(
    ({ nodeId }, config) => {
      if (!KnownNodeIdSchema.safeParse(nodeId).success) {
        return `No service or topic "${nodeId}" exists on the map; nothing was shown.`;
      }
      emitMapAction(config, { type: 'action', kind: 'showBlastRadius', nodeId });
      return `Showing the blast radius of ${nodeId} on the map.`;
    },
    {
      name: SHOW_BLAST_RADIUS_TOOL_NAME,
      description: 'Show on the map what breaks if a service or topic goes down or changes.',
      schema: NodeInputSchema,
    },
  );

  const openPassport = tool(
    ({ nodeId }, config) => {
      if (!KnownNodeIdSchema.safeParse(nodeId).success) {
        return `No service or topic "${nodeId}" exists on the map; nothing was opened.`;
      }
      emitMapAction(config, { type: 'action', kind: 'openPassport', nodeId });
      return `Opened the details card of ${nodeId}.`;
    },
    {
      name: OPEN_PASSPORT_TOOL_NAME,
      description: "Open a service's or topic's details card (its passport) on the map.",
      schema: NodeInputSchema,
    },
  );

  const showHealth = tool(
    (_input, config) => {
      emitMapAction(config, { type: 'action', kind: 'showHealth' });
      return 'Showing the health overlay on the map.';
    },
    {
      name: SHOW_HEALTH_TOOL_NAME,
      description: 'Turn on the health overlay (commit freshness, open PRs, on-call) for every service.',
      schema: NoInputSchema,
    },
  );

  const showOwnership = tool(
    (_input, config) => {
      emitMapAction(config, { type: 'action', kind: 'showOwnership' });
      return 'Showing the ownership overlay on the map.';
    },
    {
      name: SHOW_OWNERSHIP_TOOL_NAME,
      description: 'Turn on the ownership overlay that colors every service by its owning team.',
      schema: NoInputSchema,
    },
  );

  const openChangelogEntry = tool(
    ({ entryId }, config) => {
      if (!KnownDriftEntryIdSchema.safeParse(entryId).success) {
        return `No changelog entry "${entryId}" exists; nothing was opened.`;
      }
      emitMapAction(config, { type: 'action', kind: 'openChangelogEntry', entryId });
      return `Opened changelog entry ${entryId}.`;
    },
    {
      name: OPEN_CHANGELOG_ENTRY_TOOL_NAME,
      description: 'Open one drift changelog entry so the visitor sees its evidence and PR.',
      schema: ChangelogEntryInputSchema,
    },
  );

  return [highlightServices, playScenario, showBlastRadius, openPassport, showHealth, showOwnership, openChangelogEntry];
}
