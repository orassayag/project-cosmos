import type { DemoScriptedAnswer } from './types';

export const DEMO_QUESTION = 'What changed in the Shipping Galaxy over the past 24 hours?';

/** The services the answer names, in the order it mentions them. */
export const DEMO_ANSWER_SERVICE_IDS = ['shipping', 'notifications', 'orders'];

/** Facts come from the newest Fulfillment-team run in `scenarios/drift.ts` (2026-08-13). */
export const DEMO_SCRIPTED_ANSWER: DemoScriptedAnswer = {
  text:
    "Last night's Drift Sync caught two changes around shipping, both owned by the Fulfillment team. " +
    'First, shipping now publishes a new shipping.dispatched event when a parcel leaves the depot, ' +
    'and notifications subscribes to it to tell the shopper. ' +
    'Second, the orders.created event from orders gained a giftWrap flag. ' +
    'Both changes are in draft PR #128.',
  thinkingMs: 1500,
  wordMs: 90,
  actions: [{ type: 'action', kind: 'highlight', serviceIds: DEMO_ANSWER_SERVICE_IDS }],
};
