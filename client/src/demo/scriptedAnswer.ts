import type { DemoScriptedAnswer } from './types';

export const DEMO_QUESTION = 'Which services does placing an order go through, and who owns them?';

/** The services the answer names, in the order `shopping.place-order` reaches them. */
export const DEMO_ANSWER_SERVICE_IDS = [
  'storefront',
  'api-gateway',
  'orders',
  'payments',
  'inventory',
  'realtime-hub',
  'notifications',
];

/** Facts come from the `shopping.place-order` steps and each service's team in `owners.ts`. */
export const DEMO_SCRIPTED_ANSWER: DemoScriptedAnswer = {
  text:
    'Placing an order starts in storefront and goes through api-gateway, both owned by the Shopping team. ' +
    'The gateway routes it to orders, which drafts the order and asks payments to capture the charge. ' +
    'Once payment is confirmed, inventory reserves the stock. These three belong to the Fulfillment team. ' +
    'Finally, realtime-hub pushes "Order confirmed!" to the shopper\'s tab and notifications sends the email. ' +
    'The Engagement team owns both.',
  thinkingMs: 1500,
  wordMs: 90,
  actions: [{ type: 'action', kind: 'highlight', serviceIds: DEMO_ANSWER_SERVICE_IDS }],
};
