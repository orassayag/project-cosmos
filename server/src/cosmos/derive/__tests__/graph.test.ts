import { describe, expect, it } from 'vitest';
import { deriveConnectedNodeIds, deriveLinks, deriveLogicalEdges, expandStepHops } from '../graph.js';
import { deriveTopicGroups } from '../topicGroups.js';
import { makeCosmosData, makeStep, makeTopic } from './cosmosFixture.js';

describe('expandStepHops', () => {
  it('routes a 3-hop broadcast through the topic, then over a socket', () => {
    const step = makeStep(1, 'checkout', 'browser', { type: 'kafka', via: 'order.placed', through: 'hub' });
    expect(expandStepHops(step)).toStrictEqual([
      { from: 'checkout', to: 'order.placed', type: 'kafka' },
      { from: 'order.placed', to: 'hub', type: 'kafka' },
      { from: 'hub', to: 'browser', type: 'ws' },
    ]);
  });
});

describe('deriveLogicalEdges', () => {
  it('lists each distinct hop once, scenario steps first, then incident steps', () => {
    const data = makeCosmosData();
    data.steps.push(makeStep(1, 'gateway', 'checkout'));
    expect(deriveLogicalEdges(data).map((edge) => edge.key)).toStrictEqual([
      'gateway→checkout|http',
      'checkout→order.placed|kafka',
      'order.placed→mailer|kafka',
      'mailer→bucket|internal',
      'bucket→gateway|http',
    ]);
  });

  it('skips hops to ids that are not a service or topic, such as sub-services', () => {
    const data = makeCosmosData();
    data.steps.push(makeStep(1, 'gateway', 'gateway-ingest'));
    expect(deriveLogicalEdges(data).some((edge) => edge.to === 'gateway-ingest')).toBe(false);
  });
});

describe('deriveConnectedNodeIds', () => {
  it('collects scenario-step endpoints only, never incident-only hops or unused topics', () => {
    const data = makeCosmosData();
    data.incidents[0].steps.push(makeStep(101, 'gateway', 'order.orphan'));
    expect(deriveConnectedNodeIds(data)).toStrictEqual(['gateway', 'checkout', 'mailer', 'order.placed', 'bucket']);
  });
});

describe('deriveLinks', () => {
  it('records calls, publishes, consumes and domains per service, and producers/consumers per topic', () => {
    const { serviceLinks, topicLinks } = deriveLinks(makeCosmosData());
    expect(serviceLinks.gateway).toStrictEqual({ calls: ['checkout'], publishes: [], consumes: [], domains: ['shopping'] });
    expect(serviceLinks.checkout.publishes).toStrictEqual(['order.placed']);
    expect(serviceLinks.mailer).toStrictEqual({
      calls: ['bucket'],
      publishes: [],
      consumes: ['order.placed'],
      domains: ['shopping'],
    });
    expect(topicLinks['order.placed']).toStrictEqual({ producers: ['checkout'], consumers: ['mailer'] });
    expect(topicLinks['order.orphan']).toStrictEqual({ producers: [], consumers: [] });
  });
});

describe('deriveTopicGroups', () => {
  it('groups connected topics under their groupServiceId and drops unconnected ones', () => {
    const data = makeCosmosData();
    expect(deriveTopicGroups(data, deriveConnectedNodeIds(data))).toStrictEqual([
      { id: 'group-checkout', serviceId: 'checkout', memberIds: ['order.placed'] },
    ]);
  });

  it('drops a topic whose group names an unknown service', () => {
    const data = makeCosmosData({ topics: [makeTopic('order.placed', 'ghost')] });
    expect(deriveTopicGroups(data, deriveConnectedNodeIds(data))).toStrictEqual([]);
  });
});
