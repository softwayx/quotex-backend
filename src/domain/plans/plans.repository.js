import { Plan, toRow } from '../../models/index.js';

const byCurrency = (a, b) => a.currency.localeCompare(b.currency);

/** A plan as the pages expect it: `prices` sorted by currency, like the old SQL. */
const toPlan = (doc) => {
  const plan = toRow(doc);
  return plan && { ...plan, prices: [...(plan.prices ?? [])].sort(byCurrency) };
};

/** `activeOnly` hides inactive plans; `excludeTrial` hides the auto-assigned trial plan. */
export const listPlans = async ({ activeOnly = false, excludeTrial = false } = {}) => {
  const filter = {};
  if (activeOnly) filter.is_active = true;
  if (excludeTrial) filter.is_trial = false;
  const plans = await Plan.find(filter).sort({ is_trial: -1, duration_days: 1, created_at: 1 }).lean();
  return plans.map(toPlan);
};

export const getPlan = async (id, session) => toPlan(await Plan.findById(id, null, { session }).lean());

/** Price of a plan in one currency, or null if it is not sold in that currency. */
export const getPlanPrice = async (planId, currency, session) => {
  const plan = await Plan.findById(planId, 'prices', { session }).lean();
  return plan?.prices.find((price) => price.currency === currency)?.amount ?? null;
};

/** The fixed system trial plan handed to every new user. */
export const getActiveTrialPlan = async (session) =>
  toPlan(await Plan.findOne({ is_trial: true, is_active: true }, null, { session }).sort({ created_at: -1 }).lean());

/** Updates duration, on/off and (optionally) all prices. The first price also fills the legacy price/currency. */
export const updatePlan = async (id, { durationDays, isActive, prices }, session) => {
  const set = {};
  if (durationDays !== undefined) set.duration_days = durationDays;
  if (isActive !== undefined) set.is_active = isActive;
  if (prices) Object.assign(set, { prices, price: prices[0].amount, currency: prices[0].currency });
  const updated = await Plan.findOneAndUpdate({ _id: id }, { $set: set }, { returnDocument: 'after', session, lean: true });
  return toPlan(updated);
};
