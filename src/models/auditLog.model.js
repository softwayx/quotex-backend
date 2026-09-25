import mongoose from 'mongoose';
import { defineModel } from './base.js';

/** Every admin action is recorded, in the same transaction as the change. */
export default defineModel(
  'AuditLog',
  'admin_audit_log',
  {
    admin_id: { type: String, default: null },
    user_id: { type: String, default: null },
    action: { type: String, required: true },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  [[{ created_at: -1 }], [{ user_id: 1, created_at: -1 }]],
);
