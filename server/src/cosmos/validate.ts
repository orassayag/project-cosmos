import type { CosmosData, CosmosValidationIssue, Step } from './types.js';

export const WORLD_WIDTH = 2400;
export const WORLD_HEIGHT = 1400;
export const MIN_CAPSULE_SPACING = 150;

interface StepOwner {
  scenarioPhaseIds?: Set<number>;
  incidentId?: string;
  incidentPhaseId?: number;
}

interface NodeIndex {
  serviceIds: Set<string>;
  topicIds: Set<string>;
}

function findDuplicates(values: readonly (string | number)[]): (string | number)[] {
  const seen = new Set<string | number>();
  const duplicates = new Set<string | number>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

function error(code: string, message: string, context: Record<string, unknown>): CosmosValidationIssue {
  return { severity: 'error', code, message, context };
}

function checkUniqueIds(data: CosmosData): CosmosValidationIssue[] {
  const nodeIds = [
    ...data.services.map((service) => service.id),
    ...data.services.flatMap((service) => (service.subServices ?? []).map((subService) => subService.id)),
    ...data.topics.map((topic) => topic.id),
  ];
  const playableIds = [...data.scenarios.map((scenario) => scenario.id), ...data.incidents.map((incident) => incident.id)];
  const phaseIds = [...data.scenarios, ...data.incidents]
    .map((playable) => playable.phaseId)
    .filter((phaseId): phaseId is number => phaseId != null);
  return [
    ...findDuplicates(nodeIds).map((id) =>
      error('duplicate-node-id', `node id "${id}" is used by more than one service, sub-service or topic`, { id }),
    ),
    ...findDuplicates(playableIds).map((id) =>
      error('duplicate-playable-id', `playable id "${id}" is used by more than one scenario or incident`, { id }),
    ),
    ...findDuplicates(phaseIds).map((phaseId) =>
      error('duplicate-phase-id', `phaseId ${phaseId} is used by more than one scenario or incident`, { phaseId }),
    ),
  ];
}

function checkStep(step: Step, stepIndex: number, owner: StepOwner, nodes: NodeIndex): CosmosValidationIssue[] {
  const issues: CosmosValidationIssue[] = [];
  const context = { stepIndex, phase: step.phase, label: step.label, ...(owner.incidentId && { incidentId: owner.incidentId }) };
  const isKnownNode = (id: string) => nodes.serviceIds.has(id) || nodes.topicIds.has(id);

  if (owner.scenarioPhaseIds && !owner.scenarioPhaseIds.has(step.phase)) {
    issues.push(error('unknown-phase', `step.phase ${step.phase} has no matching Scenario.phaseId`, context));
  }
  if (owner.incidentId && step.phase !== owner.incidentPhaseId) {
    issues.push(
      error('incident-step-phase-mismatch', `step.phase ${step.phase} does not equal incident phaseId ${owner.incidentPhaseId}`, context),
    );
  }
  if (!isKnownNode(step.from)) {
    issues.push(error('unknown-step-from', `step.from "${step.from}" is not a known service, sub-service or topic`, context));
  }
  if (!isKnownNode(step.to)) {
    issues.push(error('unknown-step-to', `step.to "${step.to}" is not a known service, sub-service or topic`, context));
  }
  if (step.through && !nodes.serviceIds.has(step.through)) {
    issues.push(error('unknown-step-through', `step.through "${step.through}" is not a known service or sub-service`, context));
  }
  if (step.type === 'kafka' && !step.via) {
    issues.push(error('kafka-step-missing-via', 'Kafka step has no "via" topic id', context));
  }
  if (step.via && !nodes.topicIds.has(step.via)) {
    issues.push(error('unknown-step-via', `step.via "${step.via}" is not a known topic id`, context));
  }
  return issues;
}

function checkSteps(data: CosmosData, nodes: NodeIndex): CosmosValidationIssue[] {
  const scenarioPhaseIds = new Set(
    data.scenarios.map((scenario) => scenario.phaseId).filter((phaseId): phaseId is number => phaseId != null),
  );
  return [
    ...data.steps.flatMap((step, stepIndex) => checkStep(step, stepIndex, { scenarioPhaseIds }, nodes)),
    ...data.incidents.flatMap((incident) =>
      incident.steps.flatMap((step, stepIndex) =>
        checkStep(step, stepIndex, { incidentId: incident.id, incidentPhaseId: incident.phaseId }, nodes),
      ),
    ),
  ];
}

function checkGeometry(data: CosmosData): CosmosValidationIssue[] {
  const issues: CosmosValidationIssue[] = [];
  for (const node of [...data.services, ...data.topics]) {
    if (node.x < 0 || node.x > WORLD_WIDTH || node.y < 0 || node.y > WORLD_HEIGHT) {
      issues.push(
        error('out-of-world', `node "${node.id}" at (${node.x}, ${node.y}) is outside the ${WORLD_WIDTH}×${WORLD_HEIGHT} world`, {
          id: node.id,
          x: node.x,
          y: node.y,
        }),
      );
    }
  }
  data.services.forEach((first, firstIndex) => {
    for (const second of data.services.slice(firstIndex + 1)) {
      const distance = Math.hypot(first.x - second.x, first.y - second.y);
      if (distance < MIN_CAPSULE_SPACING) {
        issues.push(
          error(
            'capsules-too-close',
            `capsules "${first.id}" and "${second.id}" are ${distance.toFixed(1)}px apart (minimum ${MIN_CAPSULE_SPACING}px)`,
            { ids: [first.id, second.id], distance },
          ),
        );
      }
    }
  });
  return issues;
}

function checkReferences(data: CosmosData, nodes: NodeIndex): CosmosValidationIssue[] {
  const issues: CosmosValidationIssue[] = [];
  const domainIds = new Set(data.domains.map((domain) => domain.id));
  const topLevelServiceIds = new Set(data.services.map((service) => service.id));

  for (const scenario of data.scenarios) {
    if (!domainIds.has(scenario.domain)) {
      issues.push(
        error('unknown-scenario-domain', `scenario "${scenario.id}" names unknown domain "${scenario.domain}"`, {
          scenario: scenario.id,
          domain: scenario.domain,
        }),
      );
    }
  }
  for (const service of data.services) {
    if (service.team && !(service.team in data.owners.teams)) {
      issues.push(
        error('unknown-team', `service "${service.id}" names team "${service.team}" with no owner entry`, {
          service: service.id,
          team: service.team,
        }),
      );
    }
    // Ported from drift-sync validate: a repo with no team sends drift PRs to the fallback owner.
    if (service.repo && !service.team && !(service.id in data.owners.serviceOverrides)) {
      issues.push({
        severity: 'warn',
        code: 'service-no-owner',
        message: `service "${service.id}" (repo: ${service.repo}) has no team — drift PRs will hit the fallback owner`,
        context: { service: service.id },
      });
    }
  }
  for (const entry of data.drift.entries) {
    for (const nodeId of entry.nodeIds) {
      if (!nodes.serviceIds.has(nodeId) && !nodes.topicIds.has(nodeId)) {
        issues.push(
          error('unknown-drift-node', `drift entry "${entry.id}" names unknown node "${nodeId}"`, { entry: entry.id, nodeId }),
        );
      }
    }
  }
  for (const health of data.health.services) {
    if (!topLevelServiceIds.has(health.serviceId)) {
      issues.push(
        error('unknown-health-service', `health row names unknown service "${health.serviceId}"`, { serviceId: health.serviceId }),
      );
    }
  }
  return issues;
}

/** Returns every invariant violation; an empty `errors` list means the data is safe to serve. */
export function validateCosmos(data: CosmosData): { errors: CosmosValidationIssue[]; warnings: CosmosValidationIssue[] } {
  const nodes: NodeIndex = {
    serviceIds: new Set(data.services.flatMap((service) => [service.id, ...(service.subServices ?? []).map((sub) => sub.id)])),
    topicIds: new Set(data.topics.map((topic) => topic.id)),
  };
  const issues = [...checkUniqueIds(data), ...checkSteps(data, nodes), ...checkGeometry(data), ...checkReferences(data, nodes)];
  return {
    errors: issues.filter((issue) => issue.severity === 'error'),
    warnings: issues.filter((issue) => issue.severity === 'warn'),
  };
}
