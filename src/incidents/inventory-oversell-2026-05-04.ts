import type { Incident } from './types';

/**
 * Recorded incident — a hot SKU oversold when a reservation race let two
 * confirmed orders claim the same last unit. phaseId 102 is globally unique.
 */
export const INVENTORY_OVERSELL_2026_05_04: Incident = {
  incident: true,
  id: 'inventory-oversell-2026-05-04',
  domain: 'incidents',
  phaseId: 102,
  status: 'ready',
  label: 'Inventory oversell',
  color: 'var(--svc-amber)',
  date: '2026-05-04',
  time: '09:41 UTC',
  note: 'A flash sale on the last GravLock Mk IX let two orders reserve the same unit. The conditional write was correct, but a stale read outside the condition let both pass the app-level stock check first.',
  short: 'A reservation race oversells the last unit of a hot SKU during a flash sale.',
  refs: [
    { label: 'Post-mortem ticket', url: 'https://tickets.astromart.dev/INC-2188' },
  ],
  steps: [
    { phase: 102, from: 'orders', to: 'inventory', via: 'orders.created', type: 'kafka', label: 'orders.created (order A)', title: 'Order A confirmed — reserve last unit',
      plain: `Order A is confirmed and announced on orders.created. inventory begins reserving the one remaining GravLock Mk IX from the Luna warehouse.`,
      payload: `// Kafka record on orders.created
// key: ord_A991...
{
  "orderId": "ord_A991...",
  "items": [{ "skuId": "sku_magboot_gravlock_9", "qty": 1 }],
  "shippingRegion": "luna-colony"
}` },
    { phase: 102, from: 'orders', to: 'inventory', via: 'orders.created', type: 'kafka', label: 'orders.created (order B)', title: 'Order B confirmed — same SKU, same instant', parallel: true,
      plain: `~40ms later, Order B for the same SKU lands. Both consumers read sellable stock = 1 with a plain GetItem *before* the conditional write — so both believed the unit was theirs.`,
      payload: `// Kafka record on orders.created
// key: ord_B004...
{
  "orderId": "ord_B004...",
  "items": [{ "skuId": "sku_magboot_gravlock_9", "qty": 1 }],
  "shippingRegion": "luna-colony"
}` },
    { phase: 102, from: 'inventory', to: 'inventory', type: 'internal', label: 'Two conditional writes race', title: 'inventory: both writes target the same item',
      plain: `Both handlers issue a DynamoDB conditional write. The condition itself is sound — but the app had already logged "stock available" for both from the earlier stale read, so both orders were told they were fine before the writes resolved.`,
      payload: `// DynamoDB UpdateItem (order A)  → SUCCESS  available 1 → 0
// DynamoDB UpdateItem (order B)  → ConditionalCheckFailedException
{
  "error": "ConditionalCheckFailedException",
  "table": "inventory-stock",
  "key": { "skuId": "sku_magboot_gravlock_9", "warehouse": "wh-luna-1" },
  "attemptedBy": "ord_B004..."
}` },
    { phase: 102, from: 'inventory', to: 'orders', via: 'inventory.reserved', type: 'kafka', label: 'inventory.reserved (A only)', title: 'Only Order A actually got the unit',
      plain: `inventory.reserved fires for Order A alone. Order B's write failed — correct at the database layer. The bug was that the shopper for Order B had *already* seen "Order confirmed"; the fix was to move the stock check inside the conditional write and treat the failure as a hard user-facing decline.`,
      payload: `// Kafka record on inventory.reserved
// key: ord_A991...
{
  "reservationId": "rsv_77C2...",
  "orderId": "ord_A991...",
  "lines": [{ "skuId": "sku_magboot_gravlock_9", "qty": 1, "warehouse": "wh-luna-1" }]
}` },
    { phase: 102, from: 'orders', through: 'realtime-hub', to: 'storefront', via: 'hub-broadcasts', type: 'kafka', label: '"Confirmed" already sent to B', title: 'The wrong promise reached Order B\'s tab',
      plain: `Order B's tab had already flipped to "Order confirmed!" from the optimistic path. Reversing that — an apologetic "we oversold, here is a refund" push — is the ugly manual cleanup every oversell forces. The banner you are reading is why this replay exists.`,
      payload: `// hub.broadcasts — the message we wish we hadn't sent to Order B
{
  "socket_id": "[redacted]",
  "event_name": "order-confirmed",
  "payload": { "orderId": "ord_B004...", "message": "Order confirmed!" }
}` },
  ],
};
