import { AuditLog } from '../../models/index.js';

/** Records an admin action. Call inside the same transaction as the change it describes. */
export const recordAudit = ({ adminId, userId = null, action, details = {} }, session) =>
  AuditLog.create([{ admin_id: adminId, user_id: userId, action, details }], { session });
