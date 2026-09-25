import { defineModel } from './base.js';

/** Server-side login sessions, so logout and "disable user" truly revoke access. */
export default defineModel(
  'AuthSession',
  'auth_sessions',
  {
    actor_type: { type: String, enum: ['USER', 'ADMIN'], required: true },
    actor_id: { type: String, required: true },
    expires_at: { type: Date, required: true },
    revoked_at: { type: Date, default: null },
    user_agent: { type: String, default: null },
  },
  [[{ actor_type: 1, actor_id: 1 }]],
);
