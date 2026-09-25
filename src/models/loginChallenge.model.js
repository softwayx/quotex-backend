import { defineModel } from './base.js';

export default defineModel(
  'LoginChallenge',
  'login_challenges',
  {
    user_id: { type: String, required: true },
    otp_hash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expires_at: { type: Date, required: true },
    consumed_at: { type: Date, default: null },
  },
  [[{ user_id: 1, created_at: -1 }]],
);
