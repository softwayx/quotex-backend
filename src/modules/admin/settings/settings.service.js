import { withTransaction } from '../../../config/database.js';
import { recordAudit } from '../../../domain/audit/audit.service.js';
import {
  getCommunityFeatureEnabled,
  getLockMinHours,
  saveCommunityFeatureEnabled,
  saveLockMinHours,
} from '../../../domain/settings/appSettings.js';
import { getRecommendedSettings, saveRecommendedSettings } from '../../../domain/settings/recommendedSettings.js';

export { getCommunityFeatureEnabled, getLockMinHours, getRecommendedSettings };

/** Runs `save` and records `{ from, to }` under `action`, in one transaction. */
const auditedChange = (adminId, action, read, save) =>
  withTransaction(async (session) => {
    const before = await read(session);
    const after = await save(session);
    await recordAudit({ adminId, action, details: { from: before, to: after } }, session);
    return after;
  });

/**
 * Updates the recommended risk settings for everyone. Users who have not set their own value
 * follow the change immediately; users with their own values (or an active lock) keep theirs.
 */
export const updateRecommendedSettings = (adminId, input) =>
  auditedChange(adminId, 'RECOMMENDED_UPDATED', getRecommendedSettings, (session) => saveRecommendedSettings(input, adminId, session));

/** Shortest safety lock, in hours. Applies to locks that start after the change. */
export const updateLockMinHours = (adminId, hours) =>
  auditedChange(adminId, 'LOCK_SETTINGS_UPDATED', getLockMinHours, (session) => saveLockMinHours(hours, adminId, session));

/** Global switch for the community feature. */
export const updateCommunityFeatureEnabled = (adminId, enabled) =>
  auditedChange(adminId, 'COMMUNITY_FEATURE_TOGGLED', getCommunityFeatureEnabled, (session) => saveCommunityFeatureEnabled(enabled, adminId, session));
