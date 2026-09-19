/**
 * Barrel — re-exports every named symbol that consumers already import from
 * this path. Splitting into focused modules keeps each file under ~400 lines.
 */
export { SERVICES, SERVICES_BY_ID } from './services';
export { TOPICS, TOPICS_BY_ID } from './topics';
export { DOMAINS, SCENARIOS, SCENARIOS_BY_ID, scenariosForDomain, readyScenariosForDomain } from './scenarios';
export {
  DRIFT_ENTRIES,
  DRIFT_KIND_META,
  LATEST_DRIFT_DATE,
  LATEST_DRIFT_ENTRIES,
  LATEST_DRIFT_BY_NODE,
  driftEntriesByRun,
  driftPrUrl,
  driftCommitUrl,
  driftBranch,
  driftPrName,
  driftEntryMatches,
  driftRunDateTime,
} from './drift';
export type { DriftEntry, DriftKind } from './drift';

import type { Scenario, Step } from './types';
import { SCENARIOS_BY_ID } from './scenarios';
import { SHOPPING_STEPS } from './steps/shopping';
import { FULFILLMENT_STEPS } from './steps/fulfillment';
import { ENGAGEMENT_STEPS } from './steps/engagement';
import { INCIDENTS_BY_ID, INCIDENT_STEPS, isIncident } from '../incidents/data';

export { INCIDENTS, INCIDENTS_BY_ID, INCIDENT_STEPS, isIncident, INCIDENT_COMET_HEX } from '../incidents/data';
export type { Incident, IncidentRef } from '../incidents/data';

export const STEPS: Step[] = [
  ...SHOPPING_STEPS,
  ...FULFILLMENT_STEPS,
  ...ENGAGEMENT_STEPS,
];

/**
 * Every hop the map must be able to draw an edge for — normal scenario steps
 * plus every incident's inline steps. Edge derivation reads this so incident
 * comets always have a path, even for a hop no live scenario uses.
 */
export const ALL_STEPS: Step[] = [...STEPS, ...INCIDENT_STEPS];

/**
 * Any playable the runner can load, keyed by id — scenarios and incidents
 * together. Kept separate from SCENARIOS_BY_ID so listings/status that only
 * mean "scenario" never accidentally enumerate incidents.
 */
export const PLAYABLE_BY_ID: Record<string, Scenario> = {
  ...SCENARIOS_BY_ID,
  ...INCIDENTS_BY_ID,
};

export function stepsForScenario(scenario: Scenario): Step[] {
  if (isIncident(scenario)) return scenario.steps;
  if (scenario.phaseId == null) return [];
  return STEPS.filter(s => s.phase === scenario.phaseId);
}
