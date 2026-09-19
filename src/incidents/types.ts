import type { Scenario, Step } from '../scenarios/types';

/**
 * A frozen-in-time recording of a real production incident, replayed on the
 * map exactly like a scenario. An Incident *is* a Scenario (so the existing
 * runner, path drawing and step panel accept it unchanged) plus the human
 * curation an incident carries: date, a plain-language note, source links,
 * and the hops it actually took — stored inline rather than in the global
 * STEPS table, because an incident is never edited once recorded.
 *
 * No AI is involved anywhere: every field is human-authored from the logs.
 */
export interface Incident extends Scenario {
  /** Discriminator — always true. Lets `stepsForScenario` return inline steps. */
  incident: true;
  /** Date the incident started, ISO `YYYY-MM-DD`. Drives newest-first sorting. */
  date: string;
  /** Approximate start time as a human string, e.g. `14:03 UTC`. */
  time?: string;
  /** One- or two-sentence human note explaining what went wrong. */
  note: string;
  /** Plain-text links to the original logs or ticket. */
  refs?: IncidentRef[];
  /** The recorded hops, in order. Frozen — never phase-filtered. */
  steps: Step[];
}

export interface IncidentRef {
  label: string;
  url: string;
}

export function isIncident(scenario: Scenario): scenario is Incident {
  return (scenario as Partial<Incident>).incident === true;
}
