import { defineModel } from './base.js';

/** History of plan periods. `users.subscription_expires_at` mirrors the latest one. */
export default defineModel(
  'UserSubscription',
  'user_subscriptions',
  {
    user_id: { type: String, required: true },
    plan_id: { type: String, required: true },
    starts_at: { type: Date, required: true },
    expires_at: { type: Date, required: true },
    revoked_at: { type: Date, default: null },
    source: { type: String, default: 'ADMIN' },
    created_by: { type: String, default: null },
  },
  [[{ user_id: 1, created_at: -1 }]],
);
