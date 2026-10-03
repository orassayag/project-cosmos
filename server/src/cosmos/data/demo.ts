import type { CosmosDemo } from '../types.js';

/**
 * What the scripted `?demo=all` and `?demo=ai` tours show. The AI answer restates the newest
 * Fulfillment-team drift run (see drift.ts); demoData.test.ts fails if those entries move.
 */
export const DEMO: CosmosDemo = {
  allTour: {
    scenarioId: 'shopping.place-order',
    incidentId: 'hub-silence-2026-07-19',
    browseDomainId: 'fulfillment',
  },
  aiTour: {
    domainId: 'fulfillment',
    question: 'What changed in the Fulfillment Galaxy over the past 24 hours?',
    scriptedAnswer: {
      text:
        "Last night's Drift Sync caught two changes in Fulfillment, both owned by its team. " +
        'First, shipping now publishes a new shipping.dispatched event when a parcel leaves the depot, ' +
        'and notifications subscribes to it to tell the shopper. ' +
        'Second, the orders.created event from orders gained a giftWrap flag. ' +
        'Both changes are in draft PR #128.',
      thinkingMs: 1500,
      wordMs: 90,
    },
    highlightServiceIds: ['shipping', 'notifications', 'orders'],
    passportNodeId: 'shipping',
    citedDriftEntryIds: ['d-2026-08-13-shipping-dispatched', 'd-2026-08-13-orders-payload'],
  },
};
