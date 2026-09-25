import { DAY_MS } from '../../config/constants.js';
import { Plan, User, UserSubscription, lockDoc } from '../../models/index.js';

const setUserExpiry = (userId, expiresAt, session) =>
  User.updateOne({ _id: userId }, { $set: { subscription_expires_at: expiresAt } }, { session });

/** Starts a plan period for a user and mirrors its expiry onto users.subscription_expires_at. */
export const grantPlan = async ({ userId, plan, createdBy = null, startsAt = new Date() }, session) => {
  const expiresAt = new Date(startsAt.getTime() + plan.duration_days * DAY_MS);
  await UserSubscription.create(
    [{ user_id: userId, plan_id: plan.id, starts_at: startsAt, expires_at: expiresAt, source: createdBy ? 'ADMIN' : 'SYSTEM', created_by: createdBy }],
    { session },
  );
  await setUserExpiry(userId, expiresAt, session);
  return expiresAt;
};

/** The user's newest plan period that was not replaced, with its plan. */
export const latestSubscription = async (userId, session) => {
  const sub = await UserSubscription.findOne({ user_id: userId, revoked_at: null }, null, { session }).sort({ created_at: -1 }).lean();
  if (!sub) return null;
  const plan = await Plan.findById(sub.plan_id, 'name is_trial tier', { session, withDeleted: true }).lean();
  return { ...sub, id: sub._id, plan };
};

/** What the header and plans page show: current plan name, trial flag and expiry. */
export const getPlanSummary = async (userId) => {
  const [user, sub] = await Promise.all([User.findById(userId, 'subscription_expires_at').lean(), latestSubscription(userId)]);
  return {
    planId: sub?.plan_id ?? null,
    planName: sub?.plan?.name ?? null,
    isTrial: sub?.plan?.is_trial ?? false,
    expiresAt: user?.subscription_expires_at ? new Date(user.subscription_expires_at).toISOString() : null,
  };
};

/**
 * Adds free days to a user. A plan that is still running (trial or paid) is extended by the days. A user
 * with no running plan gets the Basic plan for those days, so the reward is real and not blocked by an
 * used-up trial. Returns the new expiry, or null when there is no plan to give.
 */
export const addBonusDays = async (session, userId, days) => {
  const now = new Date();
  const current = await UserSubscription.findOne({ user_id: userId, revoked_at: null }, '_id', { session }).sort({ created_at: -1 }).lean();
  const locked = current && (await lockDoc(UserSubscription, { _id: current._id }, session));

  let expiresAt;
  if (locked && new Date(locked.expires_at) > now) {
    expiresAt = new Date(new Date(locked.expires_at).getTime() + days * DAY_MS);
    await UserSubscription.updateOne({ _id: locked.id }, { $set: { expires_at: expiresAt } }, { session });
  } else {
    const plan = await Plan.findOne({ tier: 'BASIC' }, '_id', { session }).lean();
    if (!plan) return null;
    expiresAt = new Date(now.getTime() + days * DAY_MS);
    await UserSubscription.create([{ user_id: userId, plan_id: plan._id, starts_at: now, expires_at: expiresAt, source: 'REFERRAL' }], { session });
  }
  await setUserExpiry(userId, expiresAt, session);
  return expiresAt;
};

const RANK = { BASIC: 1, PRO: 2 };
const rank = (tier) => RANK[tier] ?? RANK.BASIC;

/**
 * Where a newly paid plan period starts and ends.
 * - The same or a lower plan still running is extended: the new days start when it ends.
 * - Upgrading (Basic to Pro) starts now and keeps the days left on the old plan, so nothing is lost.
 * - A running trial is replaced from now and its unused days are added on top.
 * - No plan or a lapsed plan starts from now.
 */
export const planPeriod = ({ currentExpiry, onTrial, currentTier = null, newTier = null, durationDays, now = new Date() }) => {
  const current = currentExpiry ? new Date(currentExpiry) : null;
  const running = Boolean(current && current > now);
  const upgrade = running && !onTrial && rank(newTier) > rank(currentTier);
  const extend = running && !onTrial && !upgrade;
  const startsAt = extend ? current : now;
  const keptMs = running && (onTrial || upgrade) ? current.getTime() - now.getTime() : 0;
  return { extend, startsAt, expiresAt: new Date(startsAt.getTime() + durationDays * DAY_MS + keptMs) };
};

export { setUserExpiry };
