import { getCosmosData } from '../../index.js';
import type { CosmosData, Service, Step, Topic } from '../../types.js';

export function makeService(id: string, overrides: Partial<Service> = {}): Service {
  return {
    id,
    x: 0,
    y: 0,
    width: 100,
    height: 40,
    palette: 'cyan',
    hex: '#22d3ee',
    name: id,
    sub: '',
    code: '',
    lang: '',
    role: '',
    desc: '',
    tech: [],
    ...overrides,
  };
}

export function makeTopic(id: string, groupServiceId: string, overrides: Partial<Topic> = {}): Topic {
  return { id, x: 0, y: 0, name: id, color: '', hex: '', desc: '', groupServiceId, ...overrides };
}

export function makeStep(phase: number, from: string, to: string, overrides: Partial<Step> = {}): Step {
  return { phase, from, to, type: 'http', label: '', title: '', plain: '', ...overrides };
}

/**
 * gateway → checkout (http), checkout → order.placed → mailer (kafka), mailer → bucket (internal).
 * gateway and checkout belong to teams; mailer and bucket do not.
 */
export function makeCosmosData(overrides: Partial<CosmosData> = {}): CosmosData {
  const real = structuredClone(getCosmosData());
  return {
    ...real,
    services: [
      makeService('gateway', { team: 'team-shopping', name: 'Gateway' }),
      makeService('checkout', { team: 'team-fulfillment', name: 'Checkout' }),
      makeService('mailer', { name: 'Mailer' }),
      makeService('bucket', { name: 'Bucket' }),
    ],
    topics: [makeTopic('order.placed', 'checkout'), makeTopic('order.orphan', 'checkout')],
    scenarios: [
      { id: 'flow.buy', domain: 'shopping', phaseId: 1, label: 'Buy', color: '', status: 'ready' },
      { id: 'flow.later', domain: 'shopping', label: 'Later', color: '', status: 'soon' },
    ],
    steps: [
      makeStep(1, 'gateway', 'checkout'),
      makeStep(1, 'checkout', 'mailer', { type: 'kafka', via: 'order.placed' }),
      makeStep(1, 'mailer', 'bucket', { type: 'internal' }),
    ],
    incidents: [
      {
        id: 'incident.outage',
        domain: 'shopping',
        phaseId: 101,
        label: 'Outage',
        color: '',
        status: 'ready',
        incident: true,
        date: '2026-01-01',
        note: '',
        steps: [makeStep(101, 'bucket', 'gateway')],
      },
    ],
    ...overrides,
  };
}
