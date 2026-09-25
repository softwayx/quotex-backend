import { RULE_FIELDS, RecommendedSettings, SINGLETON_ID } from '../../models/index.js';

const camel = (field) => field.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

/** snake_case field -> camelCase key, e.g. daily_loss_limit_pct -> dailyLossLimitPct. */
export const RULE_KEYS = Object.fromEntries(RULE_FIELDS.map((field) => [camel(field), field]));

const toView = (doc) => ({
  ...Object.fromEntries(Object.entries(RULE_KEYS).map(([key, field]) => [key, Number(doc[field])])),
  updatedAt: doc.updated_at,
});

/** The single shared document of recommended settings. */
export const getRecommendedSettingsDoc = (session) => RecommendedSettings.findById(SINGLETON_ID, null, { session }).lean();

export const getRecommendedSettings = async (session) => toView(await getRecommendedSettingsDoc(session));

export const saveRecommendedSettings = async (values, adminId, session) => {
  const set = Object.fromEntries(Object.entries(RULE_KEYS).map(([key, field]) => [field, values[key]]));
  const doc = await RecommendedSettings.findOneAndUpdate(
    { _id: SINGLETON_ID },
    { $set: { ...set, updated_by: adminId } },
    { returnDocument: 'after', session, lean: true },
  );
  return toView(doc);
};
