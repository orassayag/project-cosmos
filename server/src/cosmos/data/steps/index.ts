import type { Step } from '../../types.js';
import { ENGAGEMENT_STEPS } from './engagement.js';
import { FULFILLMENT_STEPS } from './fulfillment.js';
import { SHOPPING_STEPS } from './shopping.js';

export const STEPS: Step[] = [...SHOPPING_STEPS, ...FULFILLMENT_STEPS, ...ENGAGEMENT_STEPS];
