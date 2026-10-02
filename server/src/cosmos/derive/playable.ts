import type { CosmosData, CosmosPlayable, Incident, Playable, Step } from '../types.js';

export function isIncident(playable: Playable): playable is Incident {
  return (playable as Partial<Incident>).incident === true;
}

/** Incidents carry frozen steps; a scenario plays the steps tagged with its `phaseId`, or none without one. */
export function stepsForPlayable(steps: readonly Step[], playable: Playable): Step[] {
  if (isIncident(playable)) return playable.steps;
  if (playable.phaseId == null) return [];
  return steps.filter((step) => step.phase === playable.phaseId);
}

export function derivePlayable(data: CosmosData): CosmosPlayable {
  const items: Playable[] = [...data.scenarios, ...data.incidents];
  return {
    items,
    stepsById: Object.fromEntries(items.map((item) => [item.id, stepsForPlayable(data.steps, item)])),
  };
}

/** Unknown ids play nothing. */
export function stepsFor(playable: CosmosPlayable, id: string): Step[] {
  return playable.stepsById[id] ?? [];
}
