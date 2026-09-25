import { defineModel } from './base.js';

/** Sign-up details parked until the WhatsApp code is confirmed. */
export default defineModel(
  'PendingRegistration',
  'pending_registrations',
  {
    display_name: { type: String, required: true },
    username: { type: String, required: true },
    password_hash: { type: String, required: true },
    password_encrypted: { type: String, default: null },
    phone: { type: String, required: true },
    email: { type: String, required: true },
    ref: { type: String, default: null },
    otp_hash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expires_at: { type: Date, required: true },
  },
  [[{ phone: 1, created_at: -1 }]],
);
