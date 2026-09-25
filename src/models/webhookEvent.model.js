import { ALIVE, defineModel } from './base.js';

/** Razorpay deliveries already handled; a retried delivery is skipped (the event id is the idempotency key). */
export default defineModel(
  'WebhookEvent',
  'payment_webhook_events',
  {
    event_id: { type: String, required: true },
    event: { type: String, required: true },
  },
  [[{ event_id: 1 }, { unique: true, partialFilterExpression: ALIVE }]],
);
