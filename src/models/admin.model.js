import { ALIVE, defineModel } from './base.js';

export default defineModel(
  'Admin',
  'admins',
  {
    username: { type: String, required: true },
    password_hash: { type: String, required: true },
    role: { type: String, default: 'SUPER_ADMIN' },
    failed_attempts: { type: Number, default: 0 },
    login_locked_until: { type: Date, default: null },
  },
  [[{ username: 1 }, { unique: true, partialFilterExpression: ALIVE }]],
);
