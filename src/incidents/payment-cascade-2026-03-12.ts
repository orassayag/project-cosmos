import type { Incident } from './types';

/**
 * Recorded incident — payment processor timeout stormed the orders service.
 * All payloads are the real captured records with card/customer fields
 * redacted. phaseId 101 is globally unique; every step's `phase` matches it.
 */
export const PAYMENT_CASCADE_2026_03_12: Incident = {
  incident: true,
  id: 'payment-cascade-2026-03-12',
  domain: 'incidents',
  phaseId: 101,
  status: 'ready',
  label: 'Payment cascade',
  color: 'var(--svc-red)',
  date: '2026-03-12',
  time: '14:03 UTC',
  note: 'The card processor started timing out at 30s. Captures hung, orders never left "draft", and automatic retries stormed payments until the circuit breaker finally tripped.',
  short: 'Processor timeout hangs captures; orders stall in draft and retries storm payments.',
  refs: [
    { label: 'Post-mortem ticket', url: 'https://tickets.astromart.dev/INC-2041' },
    { label: 'payments logs (14:00–14:40 UTC)', url: 'https://logs.astromart.dev/r/inc-2041-payments' },
  ],
  steps: [
    { phase: 101, from: 'storefront', to: 'api-gateway', type: 'http', label: 'POST /v1/orders', title: 'Checkout arrives — nothing looks wrong yet',
      plain: `A shopper places a normal order. The gateway accepts it and forwards to orders — this hop behaved exactly as designed. The trouble is one hop downstream.`,
      payload: `POST /v1/orders
Headers:
  x-astro-idempotency-key: "idem_01JYP3M2K7"

Body:
{
  "cartId": "[redacted]",
  "items": [{ "skuId": "sku_magboot_gravlock_9", "qty": 1, "unitPrice": 42900 }],
  "currency": "GCR"
}

// 202 Accepted
{ "orderId": "ord_5F1A...", "status": "processing" }` },
    { phase: 101, from: 'orders', to: 'orders', type: 'internal', label: 'Draft order row', title: 'Order drafted — status: draft',
      plain: `orders writes the draft row to Postgres and calls payments to capture. Because the capture never confirms, this row is where hundreds of orders got stuck for the next 37 minutes.` },
    { phase: 101, from: 'orders', to: 'payments', type: 'http', label: 'POST /v1/payments/capture', title: 'orders → payments: capture request hangs',
      plain: `orders calls payments synchronously. payments forwards to the card processor — which had begun timing out at the full 30-second budget. Every capture request now blocks a connection-pool slot for 30s instead of ~900ms.`,
      payload: `POST /v1/payments/capture
Headers:
  x-astro-request-id: "req_01JYP3M4RD"

Body:
{
  "orderId": "ord_5F1A...",
  "amount": 42900,
  "currency": "GCR",
  "paymentMethodToken": "[redacted]",
  "idempotencyKey": "idem_01JYP3M2K7"
}

// no response for 30s — upstream processor timeout` },
    { phase: 101, from: 'payments', to: 'payments', type: 'internal', label: 'Processor timeout (30s)', title: 'payments: processor round-trip times out',
      plain: `Inside the PCI zone, payments waits the full 30-second budget and gives up. The pool is now saturated — healthy requests queue behind timed-out ones. This is the moment a slow dependency turned into an outage.`,
      payload: `// payments → processor
// ERROR after 30000ms
{
  "error": "UpstreamTimeout",
  "processor": "orbital-pay",
  "waitedMs": 30000,
  "poolInUse": 64,
  "poolMax": 64
}` },
    { phase: 101, from: 'payments', to: 'orders', via: 'payments.failed', type: 'kafka', label: 'payments.failed', title: 'Capture reported failed — retry armed',
      plain: `payments publishes payments.failed keyed by orderId. orders parks the order and, per policy, schedules an automatic retry — which is exactly the wrong move while the processor is already overwhelmed.`,
      payload: `// Kafka record on payments.failed
// key: orderId
{
  "orderId": "ord_5F1A...",
  "reason": "capture_timeout",
  "retryable": true,
  "attempt": 1,
  "failedAt": "2026-03-12T14:03:52.118Z"
}` },
    { phase: 101, from: 'orders', to: 'payments', type: 'http', label: 'Retry capture (storm)', title: 'orders retries — the storm builds',
      plain: `The retry (no backoff, no jitter in the code at the time) fires straight back at payments. Multiply by hundreds of parked orders and payments is now taking more load failing than it ever did succeeding. The fix shipped after this incident: exponential backoff + jitter and a circuit breaker.`,
      payload: `POST /v1/payments/capture
Headers:
  x-astro-request-id: "req_01JYP3P9QT"
  x-astro-retry-attempt: "2"

Body:
{ "orderId": "ord_5F1A...", "idempotencyKey": "idem_01JYP3M2K7" }

// 503 Service Unavailable — circuit breaker OPEN
{ "error": "CircuitOpen", "service": "payments", "retryAfterMs": 60000 }` },
  ],
};
