import { RECOMMENDED_SETTINGS } from '../domain/core/index.js';
import { RULE_KEYS } from '../domain/settings/recommendedSettings.js';
import { AppSettings, MessagingSettings, PaymentSettings, Plan, RecommendedSettings, ReferralSettings, SINGLETON_ID } from '../models/index.js';

const ensureSingleton = (Model, values = {}) =>
  Model.updateOne({ _id: SINGLETON_ID }, { $setOnInsert: values }, { upsert: true, setDefaultsOnInsert: true });

/** Fixed system plans every install starts with (the old migrations 015/016). */
const SYSTEM_PLANS = [
  { name: 'Free Trial', duration_days: 7, is_trial: true, tier: null, prices: [{ currency: 'INR', amount: 0 }] },
  { name: 'Basic', duration_days: 30, is_trial: false, tier: 'BASIC', prices: [{ currency: 'INR', amount: 100 }, { currency: 'USD', amount: 2 }] },
  { name: 'Pro', duration_days: 30, is_trial: false, tier: 'PRO', prices: [{ currency: 'INR', amount: 250 }, { currency: 'USD', amount: 5 }] },
];

/**
 * Idempotent: creates the settings documents and the system plans when they are missing, never
 * overwrites what an admin changed. Runs on every API start.
 */
export const seedDefaults = async () => {
  const recommended = Object.fromEntries(Object.entries(RULE_KEYS).map(([key, field]) => [field, RECOMMENDED_SETTINGS[key]]));
  await Promise.all([
    ensureSingleton(RecommendedSettings, recommended),
    ensureSingleton(PaymentSettings),
    ensureSingleton(ReferralSettings),
    ensureSingleton(AppSettings),
    ensureSingleton(MessagingSettings),
  ]);

  if ((await Plan.countDocuments({ is_system: true })) === 0) {
    await Plan.create(
      SYSTEM_PLANS.map((plan) => ({ ...plan, is_system: true, is_active: true, price: plan.prices[0].amount, currency: plan.prices[0].currency })),
    );
  }
};
