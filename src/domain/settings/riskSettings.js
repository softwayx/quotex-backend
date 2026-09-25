import { RiskSettings } from '../../models/index.js';
import { RULE_KEYS, getRecommendedSettingsDoc } from './recommendedSettings.js';

/** Effective settings for a user: their own value wins, `null` falls back to the recommended value. */
export const getRiskSettings = async (userId, session) => {
  const own = await RiskSettings.findOne({ user_id: userId }, null, { session }).lean();
  const recommended = await getRecommendedSettingsDoc(session);
  const settings = Object.fromEntries(
    Object.entries(RULE_KEYS).map(([key, field]) => [key, Number(own?.[field] ?? recommended[field])]),
  );
  return { ...settings, protectedLockedUntil: own?.protected_locked_until ?? null };
};

/**
 * Updates only the keys present in `values`. A number sets the user's own value;
 * `null` clears it so the user follows the recommendation again; `undefined` leaves it alone.
 */
export const saveRiskSettings = async (userId, values, session) => {
  const fields = { ...RULE_KEYS, protectedLockedUntil: 'protected_locked_until' };
  const set = {};
  for (const [key, field] of Object.entries(fields)) {
    if (values[key] !== undefined) set[field] = values[key];
  }
  if (Object.keys(set).length) await RiskSettings.updateOne({ user_id: userId }, { $set: set }, { session });
  return getRiskSettings(userId, session);
};
