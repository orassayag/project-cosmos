import { describe, expect, it } from 'vitest';
import { getCosmosData } from '../cosmos/index.js';
import type { CosmosData } from '../cosmos/types.js';
import { validateCosmos } from '../cosmos/validate.js';
import { buildCosmosDerived } from '../cosmos/view.js';

const MS_PER_DAY = 86_400_000;

function shiftDate(isoDate: string, days: number): string {
  return new Date(Date.parse(`${isoDate}T00:00:00Z`) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Cited drift entries that are missing or fall outside the 24h before `asOf`. */
function staleCitations(data: CosmosData): string[] {
  const { asOf } = buildCosmosDerived(data);
  const earliest = shiftDate(asOf, -1);
  return data.demo.aiTour.citedDriftEntryIds.filter((entryId) => {
    const entry = data.drift.entries.find((candidate) => candidate.id === entryId);
    return !entry || entry.date < earliest || entry.date > asOf;
  });
}

function withCitedDateShifted(days: number): CosmosData {
  const data = structuredClone(getCosmosData()) as CosmosData;
  const [citedId] = data.demo.aiTour.citedDriftEntryIds;
  const entry = data.drift.entries.find((candidate) => candidate.id === citedId);
  if (!entry) throw new Error(`demo cites drift entry "${citedId}", which is not in the data`);
  entry.date = shiftDate(entry.date, days);
  return data;
}

describe('demo data', () => {
  const data = getCosmosData();
  const { allTour, aiTour } = data.demo;
  const serviceIds = new Set(data.services.map((service) => service.id));

  it('names only ids that exist', () => {
    expect(validateCosmos(data).errors.filter((issue) => issue.code === 'unknown-demo-reference')).toEqual([]);
    expect(data.scenarios.find((scenario) => scenario.id === allTour.scenarioId)?.status).toBe('ready');
    expect(data.incidents.map((incident) => incident.id)).toContain(allTour.incidentId);
    expect(data.domains.map((domain) => domain.id)).toEqual(expect.arrayContaining([allTour.browseDomainId, aiTour.domainId]));
  });

  it('tours the newest incident', () => {
    const newestDate = data.incidents.map((incident) => incident.date).sort().at(-1);
    expect(data.incidents.find((incident) => incident.id === allTour.incidentId)?.date).toBe(newestDate);
  });

  it('highlights services only, each named in the scripted answer', () => {
    expect(aiTour.highlightServiceIds.length).toBeGreaterThan(0);
    for (const serviceId of aiTour.highlightServiceIds) {
      expect(serviceIds.has(serviceId), serviceId).toBe(true);
      expect(aiTour.scriptedAnswer.text).toContain(serviceId);
    }
    expect(aiTour.highlightServiceIds).toContain(aiTour.passportNodeId);
  });

  it('cites drift entries that exist and sit within 24h of asOf', () => {
    expect(aiTour.citedDriftEntryIds.length).toBeGreaterThan(0);
    expect(staleCitations(data)).toEqual([]);
  });

  it('cites drift entries whose nodes the answer highlights', () => {
    for (const entryId of aiTour.citedDriftEntryIds) {
      const entry = data.drift.entries.find((candidate) => candidate.id === entryId);
      expect(entry?.nodeIds.some((nodeId) => aiTour.highlightServiceIds.includes(nodeId)), entryId).toBe(true);
    }
  });

  it.each([-2, 2])('fails when a cited drift date moves by %i days', (days) => {
    expect(staleCitations(withCitedDateShifted(days)).length).toBeGreaterThan(0);
  });

  it('marks drift and health as fixture data', () => {
    expect(data.drift.source).toBe('fixture');
    expect(data.health.source).toBe('fixture');
  });
});
