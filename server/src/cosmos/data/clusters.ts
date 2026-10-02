import type { Cluster } from '../types.js';

// Array order is the backdrop paint order and the nebula's drift-phase order.
export const CLUSTERS: Cluster[] = [
  {
    id: 'ui',
    label: 'UI',
    serviceIds: ['storefront'],
    nebula: { anchorServiceIds: ['storefront'], base: 'cyan', hot: 'violet' },
  },
  {
    id: 'shopping',
    label: 'Shopping',
    serviceIds: ['api-gateway', 'cart', 'search', 'catalog'],
    nebula: { anchorServiceIds: ['api-gateway', 'cart', 'search', 'catalog'], base: 'green', hot: 'cyan' },
  },
  {
    id: 'fulfillment',
    label: 'Fulfillment',
    serviceIds: ['orders', 'payments', 'inventory', 'shipping'],
    nebula: { anchorServiceIds: ['orders', 'payments', 'inventory', 'shipping'], base: 'amber', hot: 'orange' },
  },
  {
    id: 'engagement',
    label: 'Engagement',
    serviceIds: ['realtime-hub', 'notifications'],
    nebula: { anchorServiceIds: ['realtime-hub', 'notifications'], base: 'magenta', hot: 'rose' },
  },
];
