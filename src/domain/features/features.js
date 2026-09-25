import { withTransaction } from '../../config/database.js';
import { FEATURES, featuresOfTier, normalizeMatrix } from '../shared/features.js';
import { PlanFeature } from '../../models/index.js';
import { recordAudit } from '../audit/audit.service.js';

/** The saved matrix merged over the code defaults, with Pro always including Basic. */
export const getFeatureMatrix = async (session) => {
  const rows = await PlanFeature.find({}, 'tier feature_key enabled', { session }).lean();
  const saved = { BASIC: {}, PRO: {} };
  for (const row of rows) saved[row.tier][row.feature_key] = row.enabled;
  return normalizeMatrix(saved);
};

const saveFeatureMatrix = async (matrix, adminId, session) => {
  const next = normalizeMatrix(matrix);
  await PlanFeature.bulkWrite(
    ['BASIC', 'PRO'].flatMap((tier) =>
      FEATURES.map(({ key }) => ({
        updateOne: {
          filter: { tier, feature_key: key, deletedAt: null },
          update: { $set: { enabled: next[tier][key], updated_by: adminId } },
          upsert: true,
        },
      })),
    ),
    { session },
  );
  return next;
};

/**
 * Which plan's features a user gets: Pro only while a Pro plan is running. The free trial, Basic,
 * older plans and anyone without a plan get the Basic features.
 */
export const tierOf = (entitlement, now = new Date()) => {
  const running = Boolean(entitlement.subscriptionExpiresAt) && new Date(entitlement.subscriptionExpiresAt) > now;
  return entitlement.planTier === 'PRO' && !entitlement.onTrial && running ? 'PRO' : 'BASIC';
};

/** Keys of the features this user has, for the plan they are on. */
export const featureKeysFor = async (entitlement, session) => featuresOfTier(await getFeatureMatrix(session), tierOf(entitlement));

/** Admin: saves the feature matrix. Pro always keeps everything Basic has. Recorded in the audit log. */
export const updatePlanFeatures = (adminId, matrix) =>
  withTransaction(async (session) => {
    const before = await getFeatureMatrix(session);
    const after = await saveFeatureMatrix(matrix, adminId, session);
    const changes = [];
    for (const tier of ['BASIC', 'PRO']) {
      for (const { key } of FEATURES) {
        if (before[tier][key] !== after[tier][key]) changes.push(`${tier}:${key}=${after[tier][key] ? 'on' : 'off'}`);
      }
    }
    await recordAudit({ adminId, action: 'PLAN_FEATURES_UPDATED', details: { changes } }, session);
    return after;
  });
