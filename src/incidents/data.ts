/**
 * Incident registry — the incident counterpart to `scenarios/data.ts`.
 * Adding a recording is a one-line change here: author a file, import it,
 * drop it in INCIDENTS. Everything downstream (the list, the player, the
 * banner, deep links) discovers it automatically.
 */
import type { Incident } from './types';
import type { Step } from '../scenarios/types';
import { PAYMENT_CASCADE_2026_03_12 } from './payment-cascade-2026-03-12';
import { INVENTORY_OVERSELL_2026_05_04 } from './inventory-oversell-2026-05-04';
import { HUB_SILENCE_2026_07_19 } from './hub-silence-2026-07-19';

export type { Incident, IncidentRef } from './types';
export { isIncident } from './types';

/** Concrete hex for the incident comet — a distinct warning red so a
 *  historical replay never reads as live protocol-coloured traffic. */
export const INCIDENT_COMET_HEX = '#ff5a52';

/** Every recorded incident, sorted newest-first (the order the UI lists them). */
export const INCIDENTS: Incident[] = [
  PAYMENT_CASCADE_2026_03_12,
  INVENTORY_OVERSELL_2026_05_04,
  HUB_SILENCE_2026_07_19,
].sort((a, b) => b.date.localeCompare(a.date));

export const INCIDENTS_BY_ID: Record<string, Incident> = Object.fromEntries(
  INCIDENTS.map((incident) => [incident.id, incident]),
);

/** Flattened hops across all incidents — folded into edge derivation so every
 *  incident hop has a rendered path for the comet to fly. */
export const INCIDENT_STEPS: Step[] = INCIDENTS.flatMap((incident) => incident.steps);
