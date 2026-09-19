import type { Incident } from './types';

/**
 * Recorded incident — realtime-hub went silent: confirmations were produced
 * but never delivered because presence lookups failed closed. phaseId 103 is
 * globally unique.
 */
export const HUB_SILENCE_2026_07_19: Incident = {
  incident: true,
  id: 'hub-silence-2026-07-19',
  domain: 'incidents',
  phaseId: 103,
  status: 'ready',
  label: 'Realtime-hub silence',
  color: 'var(--svc-cyan)',
  date: '2026-07-19',
  time: '21:12 UTC',
  note: 'Orders confirmed fine, but no shopper saw the live "Order confirmed!" update. A Redis failover left hub-presence unable to resolve socket ids, and it failed closed — dropping every broadcast instead of falling back to a poll.',
  short: 'A Redis failover makes hub-presence drop every live broadcast — confirmations never reach tabs.',
  refs: [
    { label: 'Post-mortem ticket', url: 'https://tickets.astromart.dev/INC-2301' },
    { label: 'realtime-hub dashboards', url: 'https://grafana.astromart.dev/d/hub-delivery' },
  ],
  steps: [
    { phase: 103, from: 'orders', to: 'orders', type: 'internal', label: 'Order confirmed (healthy)', title: 'Orders were fine the whole time',
      plain: `Checkout, capture and reservation all succeeded — this incident produced zero failed orders. That is what made it slow to spot: the only symptom was tabs that never updated.` },
    { phase: 103, from: 'orders', through: 'realtime-hub', to: 'storefront', via: 'hub-broadcasts', type: 'kafka', label: 'hub.broadcasts published', title: 'The confirmation was published as normal',
      plain: `orders published the confirmation on hub.broadcasts with the shopper's socket_id, exactly as designed. hub-ingest consumed it and asked hub-presence to resolve which live socket that was.`,
      payload: `// Kafka record on hub.broadcasts
{
  "customer_id": "[redacted]",
  "socket_id": "sock_9920...",
  "event_name": "order-confirmed",
  "payload": { "orderId": "ord_C551...", "message": "Order confirmed!" }
}` },
    { phase: 103, from: 'realtime-hub', to: 'realtime-hub', type: 'internal', label: 'Presence lookup fails', title: 'hub-presence can\'t reach Redis after failover',
      plain: `A Redis primary failover had just happened. hub-presence's client held a dead connection and every socket lookup errored. The code failed *closed* — treating "can't resolve" as "socket gone" — so it silently discarded the broadcast.`,
      payload: `// hub-presence → Redis (post-failover)
{
  "error": "ReplyError",
  "command": "HGET presence:sock_9920...",
  "detail": "READONLY You can't write against a read only replica.",
  "action_taken": "DROP_BROADCAST"
}` },
    { phase: 103, from: 'realtime-hub', to: 'storefront', type: 'ws', label: 'Nothing delivered', title: 'The push that never happened',
      plain: `hub-push had nothing to send, so the shopper's WebSocket stayed quiet. The page sat on its spinner until a manual refresh pulled the (already-confirmed) order over HTTP. The fix: hub-presence now fails *open* to a short poll, and delivery has a dead-letter alarm.`,
      payload: `// hub-push delivery log
{
  "socket_id": "sock_9920...",
  "delivered": false,
  "reason": "no_target_from_presence",
  "fallback": "none"   // <-- the bug: should have queued a poll
}` },
  ],
};
