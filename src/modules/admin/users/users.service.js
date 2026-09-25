import { ACTORS, DAY_MS } from '../../../config/constants.js';
import { withTransaction } from '../../../config/database.js';
import { recordAudit } from '../../../domain/audit/audit.service.js';
import { revokeAllSessions } from '../../../domain/auth/sessions.js';
import { computeSessionStats } from '../../../domain/core/index.js';
import { adminSetCountry } from '../../../domain/location/location.service.js';
import { getPlan, listPlans } from '../../../domain/plans/plans.repository.js';
import { getCommunityFeatureEnabled } from '../../../domain/settings/appSettings.js';
import { latestSubscription, setUserExpiry } from '../../../domain/subscriptions/subscriptions.js';
import { upsertDailyStat } from '../../../domain/trading/dailyStats.repository.js';
import { mapSession } from '../../../domain/trading/mappers.js';
import { closeSession, findActiveSafetyLock, findActiveSession } from '../../../domain/trading/sessions.repository.js';
import { listTrades } from '../../../domain/trading/trades.repository.js';
import {
  AuditLog,
  DailyStat,
  LoginChallenge,
  Payment,
  Referral,
  RiskSettings,
  Trade,
  TradingSession,
  TrialUsage,
  User,
  UserSubscription,
  lockDoc,
} from '../../../models/index.js';
import ApiError from '../../../utils/apiError.js';
import { iso } from '../../../utils/dates.js';
import { findUserDetail, listAudit, listUserAudit, listUserSessions, listUserSubscriptions, listUsers } from './users.reports.js';

export { adminSetCountry, listAudit, listUsers };

const IST_END_OF_DAY = 'T23:59:59+05:30';

/** Locks the user so concurrent admin actions on one user run one at a time. */
const lockUser = async (userId, session) => {
  const user = await lockDoc(User, { _id: userId }, session, { projection: 'username status subscription_expires_at' });
  if (!user) throw ApiError.notFound('User not found.');
  return user;
};

const lockLatestSubscription = async (userId, session) => {
  const sub = await latestSubscription(userId, session);
  if (sub) await lockDoc(UserSubscription, { _id: sub.id }, session);
  return sub;
};

/** Everything the admin user page shows. */
export const getUserPage = async (userId) => {
  const user = await findUserDetail(userId);
  if (!user) throw ApiError.notFound('User not found.');
  const [sessions, subscriptions, audit, plans, lock, openSession, communityFeatureEnabled] = await Promise.all([
    listUserSessions(userId),
    listUserSubscriptions(userId),
    listUserAudit(userId),
    listPlans({ activeOnly: true }),
    findActiveSafetyLock(userId),
    findActiveSession(userId),
    getCommunityFeatureEnabled(),
  ]);
  return { user, sessions, subscriptions, audit, plans, lock, openSession, communityFeatureEnabled };
};

/** Gives a user a plan. REPLACE starts now; STACK starts after the current period ends. */
export const assignPlan = (adminId, userId, { planId, mode }) =>
  withTransaction(async (session) => {
    const user = await lockUser(userId, session);
    const plan = await getPlan(planId, session);
    if (!plan) throw ApiError.notFound('Plan not found.');
    if (!plan.is_active) throw new ApiError('PLAN_INACTIVE', 'This plan is inactive.', 409);

    const now = new Date();
    const current = user.subscription_expires_at ? new Date(user.subscription_expires_at) : null;
    const stack = mode === 'STACK' && current && current > now;
    const startsAt = stack ? current : now;
    const expiresAt = new Date(startsAt.getTime() + plan.duration_days * DAY_MS);

    // The new period supersedes any open one.
    if (!stack) await UserSubscription.updateMany({ user_id: userId, revoked_at: null }, { $set: { revoked_at: now } }, { session });
    await UserSubscription.create([{ user_id: userId, plan_id: planId, starts_at: startsAt, expires_at: expiresAt, created_by: adminId }], { session });
    await setUserExpiry(userId, expiresAt, session);
    await recordAudit(
      {
        adminId,
        userId,
        action: 'PLAN_ASSIGNED',
        details: { plan: plan.name, mode: stack ? 'STACK' : 'REPLACE', startsAt: iso(startsAt), expiresAt: iso(expiresAt), previousExpiry: iso(current) },
      },
      session,
    );
    return { expiresAt };
  });

/** Moves the current plan's expiry earlier or later, by a number of days or to an exact date (IST). */
export const adjustExpiry = (adminId, userId, { days, date }) =>
  withTransaction(async (session) => {
    const user = await lockUser(userId, session);
    const sub = await lockLatestSubscription(userId, session);
    if (!sub) throw new ApiError('NO_SUBSCRIPTION', 'This user has no plan to adjust. Assign a plan first.', 409);

    const previous = new Date(sub.expires_at);
    const next = date ? new Date(`${date}${IST_END_OF_DAY}`) : new Date(previous.getTime() + days * DAY_MS);
    if (Number.isNaN(next.getTime())) throw ApiError.validation('Invalid date.');
    if (next.getTime() - Date.now() > 3650 * DAY_MS) throw ApiError.validation('Expiry is too far in the future.');

    await UserSubscription.updateOne({ _id: sub.id }, { $set: { expires_at: next } }, { session });
    await setUserExpiry(userId, next, session);
    await recordAudit(
      {
        adminId,
        userId,
        action: 'EXPIRY_ADJUSTED',
        details: { plan: sub.plan?.name ?? null, from: iso(previous), to: iso(next), by: days ?? null, setDate: date ?? null },
      },
      session,
    );
    return { expiresAt: next, username: user.username };
  });

/** Ends the plan right now. The history stays so the audit trail is complete. */
export const revokePlan = (adminId, userId) =>
  withTransaction(async (session) => {
    await lockUser(userId, session);
    const sub = await lockLatestSubscription(userId, session);
    if (!sub) throw new ApiError('NO_SUBSCRIPTION', 'This user has no plan to revoke.', 409);

    const now = new Date();
    // Close every open period (a stacked plan may not have started yet).
    await UserSubscription.updateMany(
      { user_id: userId, revoked_at: null },
      [{ $set: { expires_at: { $min: ['$expires_at', now] }, starts_at: { $min: ['$starts_at', now] } } }],
      { session, updatePipeline: true },
    );
    await setUserExpiry(userId, now, session);
    await recordAudit({ adminId, userId, action: 'PLAN_REVOKED', details: { plan: sub.plan?.name ?? null, previousExpiry: iso(sub.expires_at) } }, session);
  });

/** Disables or re-enables a user. Disabling also signs them out everywhere. */
export const setUserStatus = (adminId, userId, status) =>
  withTransaction(async (session) => {
    const user = await lockUser(userId, session);
    if (user.status === status) return { changed: false };

    await User.updateOne({ _id: userId }, { $set: { status } }, { session });
    if (status === 'SUSPENDED') await revokeAllSessions(ACTORS.USER, userId, session);
    await recordAudit({ adminId, userId, action: status === 'SUSPENDED' ? 'USER_DISABLED' : 'USER_ENABLED', details: {} }, session);
    return { changed: true };
  });

/**
 * Deletes a user and everything that belongs to them (soft delete, one transaction, so nothing is left
 * half-deleted). Only a record that the account was deleted stays visible.
 */
export const deleteUser = (adminId, userId) =>
  withTransaction(async (session) => {
    const user = await lockUser(userId, session);
    for (const Model of [Trade, DailyStat, TradingSession, RiskSettings, TrialUsage, UserSubscription, Payment, AuditLog, LoginChallenge]) {
      await Model.softDelete({ user_id: userId }, { session });
    }
    await Referral.softDelete({ $or: [{ referrer_id: userId }, { referee_id: userId }] }, { session });
    await revokeAllSessions(ACTORS.USER, userId, session);
    await User.softDelete({ _id: userId }, { session });
    await recordAudit({ adminId, userId: null, action: 'USER_DELETED', details: { username: user.username } }, session);
    return { deleted: true };
  });

/**
 * Lets a user trade again after a session lock. The stopped session is closed with its summary saved,
 * the lock is removed, and the user can start a new session. Never touches the protected-settings lock.
 */
export const unlockUserTrading = (adminId, userId, reason) =>
  withTransaction(async (session) => {
    const user = await lockUser(userId, session);
    const now = new Date();
    const sessions = (
      await TradingSession.find(
        { user_id: userId, $or: [{ status: { $in: ['LIMIT_REACHED', 'TARGET_REACHED'] } }, { safety_locked_until: { $gt: now } }] },
        null,
        { session },
      ).lean()
    ).map(mapSession);
    if (sessions.length === 0) throw ApiError.validation('This user has no session lock to remove.');

    const reasons = [];
    for (const tradingSession of sessions) {
      reasons.push(tradingSession.lockReason ?? tradingSession.status);
      if (tradingSession.status !== 'CLOSED') {
        const trades = await listTrades(tradingSession.id, session);
        const stats = computeSessionStats({ trades, startingCapital: tradingSession.startingCapital, target: tradingSession.target });
        await upsertDailyStat({ session: tradingSession, stats, limitReached: tradingSession.status === 'LIMIT_REACHED' }, session);
        await closeSession(tradingSession.id, session);
      }
    }
    await TradingSession.updateMany({ user_id: userId, safety_locked_until: { $gt: now } }, { $set: { safety_locked_until: null } }, { session });
    await recordAudit(
      { adminId, userId, action: 'USER_UNLOCKED', details: { username: user.username, lockReasons: reasons, ...(reason && { note: reason }) } },
      session,
    );
    return { unlocked: true, sessions: sessions.length };
  });

/** Grants or revokes early access to the community board, ahead of the normal wait period. */
export const setCommunityEarlyAccess = (adminId, userId, granted) =>
  withTransaction(async (session) => {
    const user = await lockUser(userId, session);
    await User.updateOne({ _id: userId }, { $set: { community_early_access: granted } }, { session });
    await recordAudit(
      { adminId, userId, action: granted ? 'COMMUNITY_ACCESS_GRANTED' : 'COMMUNITY_ACCESS_REVOKED', details: { username: user.username } },
      session,
    );
    return { granted };
  });
