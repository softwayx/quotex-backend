import { FREE_TRADE_ALLOWANCE } from '../core/index.js';
import { TrialUsage, User } from '../../models/index.js';
import { latestSubscription } from '../subscriptions/subscriptions.js';

/** Free-analysis usage plus what kind of plan the user is on (trial or paid). */
export const getEntitlement = async (userId, session) => {
  // Sequential: one transaction session must not run operations in parallel.
  const usage = await TrialUsage.findOne({ user_id: userId }, 'analyses_used', { session }).lean();
  const user = await User.findById(userId, 'subscription_expires_at', { session }).lean();
  const sub = await latestSubscription(userId, session);
  return {
    analysesUsed: usage?.analyses_used ?? 0,
    subscriptionExpiresAt: user?.subscription_expires_at ?? null,
    onTrial: sub?.plan?.is_trial ?? false,
    planTier: sub?.plan?.tier ?? null,
  };
};

export const incrementAnalysesUsed = (userId, session) =>
  TrialUsage.updateOne({ user_id: userId }, { $inc: { analyses_used: 1 } }, { session });

/** A paid (non-trial) plan whose period has not ended. Unlimited analyses. */
export const hasActiveSubscription = (entitlement, now = new Date()) =>
  Boolean(entitlement.subscriptionExpiresAt) && !entitlement.onTrial && new Date(entitlement.subscriptionExpiresAt) > now;

/**
 * Access rules:
 * - active paid plan            -> unlimited
 * - trial plan                  -> up to FREE_TRADE_ALLOWANCE analyses, and only until the trial period ends
 * - no plan / lapsed paid plan  -> remaining free analyses, then paywall
 */
export const freeAnalysesView = (entitlement, now = new Date()) => {
  const subscribed = hasActiveSubscription(entitlement, now);
  const trialExpired =
    Boolean(entitlement.onTrial) && Boolean(entitlement.subscriptionExpiresAt) && new Date(entitlement.subscriptionExpiresAt) <= now;
  const allowanceUsed = entitlement.analysesUsed >= FREE_TRADE_ALLOWANCE;

  return {
    used: entitlement.analysesUsed,
    total: FREE_TRADE_ALLOWANCE,
    remaining: Math.max(0, FREE_TRADE_ALLOWANCE - entitlement.analysesUsed),
    subscribed,
    trialExpired,
    paywalled: !subscribed && (trialExpired || allowanceUsed),
  };
};
