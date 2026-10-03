import { describe, expect, it } from 'vitest';
import { getCosmosData } from '../cosmos/index.js';
import type { CosmosData } from '../cosmos/types.js';
import { validateCosmos } from '../cosmos/validate.js';

function brokenClone(breakData: (data: CosmosData) => void): CosmosData {
  const data = structuredClone(getCosmosData());
  breakData(data);
  return data;
}

function errorCodes(data: CosmosData): string[] {
  return validateCosmos(data).errors.map((issue) => issue.code);
}

function findService(data: CosmosData, id: string) {
  const service = data.services.find((candidate) => candidate.id === id);
  if (!service) throw new Error(`fixture is missing service "${id}"`);
  return service;
}

describe('validateCosmos', () => {
  it('accepts the real data with no errors or warnings', () => {
    expect(validateCosmos(getCosmosData())).toEqual({ errors: [], warnings: [] });
  });

  it.each<[string, (data: CosmosData) => void]>([
    ['duplicate-node-id', (data) => { data.topics[0].id = data.services[0].id; }],
    ['duplicate-playable-id', (data) => { data.incidents[0].id = data.scenarios[0].id; }],
    ['duplicate-phase-id', (data) => { data.scenarios[1].phaseId = data.scenarios[0].phaseId; }],
    ['unknown-phase', (data) => { data.steps[0].phase = 999; }],
    ['unknown-step-from', (data) => { data.steps[0].from = 'no-such-service'; }],
    ['unknown-step-to', (data) => { data.steps[0].to = 'no-such-service'; }],
    ['unknown-step-through', (data) => {
      const step = data.steps.find((candidate) => candidate.through);
      if (!step) throw new Error('fixture has no 3-hop step');
      step.through = 'no-such-service';
    }],
    ['unknown-step-via', (data) => {
      const step = data.steps.find((candidate) => candidate.via);
      if (!step) throw new Error('fixture has no Kafka step');
      step.via = 'no.such.topic';
    }],
    ['kafka-step-missing-via', (data) => {
      const step = data.steps.find((candidate) => candidate.type === 'kafka');
      if (!step) throw new Error('fixture has no Kafka step');
      delete step.via;
    }],
    ['incident-step-phase-mismatch', (data) => { data.incidents[0].steps[0].phase = data.scenarios[0].phaseId!; }],
    ['capsules-too-close', (data) => {
      const [first, second] = data.services;
      second.x = first.x + 100;
      second.y = first.y;
    }],
    ['out-of-world', (data) => { data.topics[0].x = 2401; }],
    ['unknown-scenario-domain', (data) => { data.scenarios[0].domain = 'no-such-domain'; }],
    ['unknown-team', (data) => {
      Object.assign(data.services[0], { team: 'team-nobody' });
    }],
    ['unknown-drift-node', (data) => { data.drift.entries[0].nodeIds.push('no-such-node'); }],
    ['unknown-health-service', (data) => { data.health.services[0].serviceId = 'no-such-service'; }],
    ['duplicate-cluster-id', (data) => { data.clusters[1].id = data.clusters[0].id; }],
    ['service-hex-mismatch', (data) => { data.services[0].hex = '#000000'; }],
    ['unknown-cluster-service', (data) => { data.clusters[0].serviceIds.push('no-such-service'); }],
    ['unknown-topic-group', (data) => { data.topics[0].groupServiceId = 'no-such-service'; }],
    ['unknown-ecosystem-node', (data) => {
      const service = data.services.find((candidate) => candidate.ecosystem);
      if (!service?.ecosystem) throw new Error('fixture has no service ecosystem');
      service.ecosystem.internalEdges[0].to = 'no-such-sub-service';
    }],
    ['unknown-demo-reference', (data) => { data.demo.aiTour.turns[0].actions.push({ type: 'action', kind: 'openPassport', nodeId: 'no-such-node' }); }],
    ['unknown-demo-reference', (data) => { data.demo.aiTour.turns[1].actions.push({ type: 'action', kind: 'playScenario', scenarioId: 'no-such-scenario' }); }],
    ['demo-follow-up-mismatch', (data) => { data.demo.aiTour.turns[0].followUps[0] = 'Who owns shipping'; }],
    ['demo-follow-up-mismatch', (data) => { data.demo.aiTour.turns[0].followUps = []; }],
  ])('reports %s on a deliberately broken clone', (expectedCode, breakData) => {
    expect(errorCodes(brokenClone(breakData))).toContain(expectedCode);
  });

  it('names the turn and both questions when a demo chip does not ask the next question', () => {
    const data = brokenClone((clone) => { clone.demo.aiTour.turns[0].followUps = ['Who runs shipping?']; });
    const issue = validateCosmos(data).errors.find((candidate) => candidate.code === 'demo-follow-up-mismatch');
    expect(issue?.context).toEqual({ turnIndex: 0, followUp: 'Who runs shipping?', nextQuestion: data.demo.aiTour.turns[1].question });
  });

  it('reports which demo turn action names an unknown id', () => {
    const data = brokenClone((clone) => {
      clone.demo.aiTour.turns[1].actions.push({ type: 'action', kind: 'highlight', serviceIds: ['shipping', 'no-such-service'] });
    });
    const issues = validateCosmos(data).errors.filter((candidate) => candidate.code === 'unknown-demo-reference');
    expect(issues.map((issue) => issue.context)).toEqual([{ field: 'aiTour.turns.1.actions.highlight', id: 'no-such-service' }]);
  });

  it('reports a dangling incident step with the incident id', () => {
    const data = brokenClone((clone) => { clone.incidents[0].steps[0].to = 'no-such-service'; });
    const issue = validateCosmos(data).errors.find((candidate) => candidate.code === 'unknown-step-to');
    expect(issue?.context).toMatchObject({ incidentId: data.incidents[0].id, stepIndex: 0 });
  });

  it('reports capsules 100px apart with both ids and the distance', () => {
    const data = brokenClone((clone) => {
      const payments = findService(clone, 'payments');
      const orders = findService(clone, 'orders');
      payments.x = orders.x + 100;
      payments.y = orders.y;
    });
    const issue = validateCosmos(data).errors.find((candidate) => candidate.code === 'capsules-too-close');
    expect(issue?.context).toEqual({ ids: ['orders', 'payments'], distance: 100 });
  });

  it('warns when a repo-backed service has no team', () => {
    const data = brokenClone((clone) => { delete findService(clone, 'cart').team; });
    expect(validateCosmos(data).warnings.map((issue) => issue.code)).toEqual(['service-no-owner']);
  });

  it('reports an ecosystem egress that is not one of the service sub-services, with its id', () => {
    const data = brokenClone((clone) => {
      const service = clone.services.find((candidate) => candidate.ecosystem);
      if (!service?.ecosystem) throw new Error('fixture has no service ecosystem');
      service.ecosystem.egressSubServiceId = 'no-such-sub-service';
    });
    const issue = validateCosmos(data).errors.find((candidate) => candidate.code === 'unknown-ecosystem-node');
    expect(issue?.context).toMatchObject({ nodeId: 'no-such-sub-service' });
  });
});
