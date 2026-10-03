import type { Incident } from '../../types.js';
import { HUB_SILENCE_2026_07_19 } from './hub-silence-2026-07-19.js';
import { INVENTORY_OVERSELL_2026_05_04 } from './inventory-oversell-2026-05-04.js';
import { PAYMENT_CASCADE_2026_03_12 } from './payment-cascade-2026-03-12.js';

export const INCIDENTS: Incident[] = [PAYMENT_CASCADE_2026_03_12, INVENTORY_OVERSELL_2026_05_04, HUB_SILENCE_2026_07_19];
