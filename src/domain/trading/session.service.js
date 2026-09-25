import {
  ACCURACY_STAGE,
  PROFIT_STAGE,
  baseTradeAmount,
  buildTipsProfile,
  canStopAtMilestone,
  computeSessionStats,
  dailyLossLimitAmount,
  evaluateAccuracyGuard,
  evaluateProtection,
  isTargetReached,
  milestoneCrossed,
  resolvePayout,
  safetyLockUntil,
  scoreSession,
  tradePnl,
} from '../core/index.js';
import { withTransaction } from '../../config/database.js';
import ApiError from '../../utils/apiError.js';
import { freeAnalysesView, getEntitlement, incrementAnalysesUsed } from '../entitlements/entitlements.js';
import { featureKeysFor } from '../features/features.js';
import { getDisplayRate } from '../fx/exchangeRates.js';
import { getLockMinHours } from '../settings/appSettings.js';
import { getRiskSettings } from '../settings/riskSettings.js';
import { listSessionsWithTrades } from './analytics.repository.js';
import { findLastClosingCapital, upsertDailyStat } from './dailyStats.repository.js';
import {
  closeSession,
  createSession,
  findActiveSafetyLock,
  findActiveSession,
  findSessionById,
  lockActiveSession,
  lockAfterClose,
  markLimitReached,
  markTargetReached,
  setLastMilestone,
  updateMinPayout,
} from './sessions.repository.js';
import { buildSessionView, profitFloorCapFor, profitProtectionFor } from './sessionView.js';
import { insertTrade, listTrades } from './trades.repository.js';

const DUPLICATE_KEY = 11000;

const errors = {
  noActiveSession: () => new ApiError('NO_ACTIVE_SESSION', "No active session. Start today's plan first.", 409),
  alreadyActive: () => new ApiError('SESSION_ALREADY_ACTIVE', 'A session is already running.', 409),
  paywall: () => new ApiError('PAYWALL', 'Your free access has ended. Choose a plan to continue.', 402),
  limitReached: () => new ApiError('LIMIT_REACHED', 'Daily loss limit reached. Trading is locked.', 423),
  targetReached: () => new ApiError('TARGET_REACHED', 'You reached your target. Trading is locked for a cooling-off period.', 423),
  milestoneNotReached: () => new ApiError('MILESTONE_NOT_REACHED', 'You can stop for the day once you reach 50% of your target.', 422),
  safetyLocked: (until) => new ApiError('SAFETY_LOCKED', 'Safety lock is active. You cannot start a new session yet.', 423, { until }),
};

/** Error for trading attempts on a session that has already stopped (loss limit or target). */
const stoppedError = (session) => (session.status === 'TARGET_REACHED' ? errors.targetReached() : errors.limitReached());

/** When a lock that starts now ends: the admin's minimum hours, or midnight IST when that is still today. */
const lockEnd = async (db) => safetyLockUntil(new Date(), await getLockMinHours(db));

/**
 * Trading platforms don't accept trades below about $1, so that's the smallest amount ever suggested or
 * allowed — in INR, whatever the user's display currency.
 */
const minTradeAmountNow = async () => {
  const { rate: usdRate } = await getDisplayRate('USD');
  return Math.ceil(1 / usdRate);
};

const PHASE_BY_STATUS = { ACTIVE: 'ACTIVE', LIMIT_REACHED: 'LIMIT_REACHED', TARGET_REACHED: 'TARGET_REACHED' };

/**
 * Self-heals a session stuck "ACTIVE" with nothing left it could safely trade, closing it the same
 * way a trade that actually crosses the line does:
 * - remaining daily loss protection is below the smallest trade the platform accepts -> daily loss limit
 * - Profit Protection has armed and its cap has shrunk below that same floor -> closes as Profit Protection
 * A no-op once already locked.
 */
const closeIfNothingLeftToTrade = async (session, trades, minTradeAmount) => {
  if (session.status !== 'ACTIVE') return session;
  const stats = computeSessionStats({ trades, startingCapital: session.startingCapital, target: session.target });
  const { limitReached } = evaluateProtection({ netPnl: stats.netPnl, limitAmount: session.dailyLossLimitAmount, minTradeAmount });
  const profitFloorCap = profitFloorCapFor(profitProtectionFor({ session, trades }));
  const profitExhausted = profitFloorCap !== null && profitFloorCap < minTradeAmount;
  if (!limitReached && !profitExhausted) return session;

  return withTransaction(async (db) => {
    const locked = await lockActiveSession(session.userId, db);
    if (!locked || locked.id !== session.id || locked.status !== 'ACTIVE') return locked ?? session;
    if (limitReached) {
      const updated = await markLimitReached(locked.id, await lockEnd(db), db);
      await upsertDailyStat({ session: locked, stats, limitReached: true }, db);
      return updated;
    }
    await upsertDailyStat({ session: locked, stats, limitReached: false }, db);
    await closeSession(locked.id, db);
    await lockAfterClose(locked.id, await lockEnd(db), 'PROFIT_PROTECTION', db);
    return { ...locked, status: 'CLOSED' };
  });
};

/** Single entry point the dashboard uses to decide what to show. */
export const getDashboard = async (user) => {
  const [entitlement, safetyLock, active, settings, lastClosingCapital] = await Promise.all([
    getEntitlement(user.id),
    findActiveSafetyLock(user.id),
    findActiveSession(user.id),
    getRiskSettings(user.id),
    findLastClosingCapital(user.id),
  ]);
  const freeAnalyses = freeAnalysesView(entitlement);
  const features = await featureKeysFor(entitlement);

  if (active) {
    const trades = await listTrades(active.id);
    const minTradeAmount = await minTradeAmountNow();
    // Nothing left the user could safely trade: close the session now instead of a stuck screen.
    const session = await closeIfNothingLeftToTrade(active, trades, minTradeAmount);
    // Closed as Profit Protection: no longer "active", so re-run to pick up the safety-lock branch.
    if (session.status === 'CLOSED') return getDashboard(user);
    const view = buildSessionView({ session, trades, entitlement, minTradeAmount });
    // Personal tips use the last 30 days of finished sessions (Pro feature).
    const tipsProfile = features.includes('live_tips')
      ? buildTipsProfile((await listSessionsWithTrades(user.id, 30)).filter((s) => s.id !== session.id && s.trades.length))
      : null;
    return { phase: PHASE_BY_STATUS[session.status], freeAnalyses, features, tipsProfile, ...view };
  }
  if (safetyLock) {
    // Show the numbers of the day that caused the lock (read-only, no trading actions).
    const lockedSession = await findSessionById(safetyLock.sessionId, user.id);
    const lockedTrades = lockedSession ? await listTrades(lockedSession.id) : [];
    const lockedView = lockedSession ? buildSessionView({ session: lockedSession, trades: lockedTrades, entitlement }) : null;
    // Discipline breakdown for the session that just closed, shown to everyone (not Pro-gated).
    const scored = lockedSession
      ? scoreSession({ ...lockedSession, trades: lockedTrades.map((trade) => ({ ...trade, at: trade.createdAt })) })
      : null;
    return {
      phase: 'SAFETY_LOCKED',
      safetyLockedUntil: safetyLock.until,
      lockReason: safetyLock.reason,
      freeAnalyses,
      features,
      lockedView: lockedView && { session: lockedView.session, stats: lockedView.stats, protection: lockedView.protection, trades: lockedView.trades },
      sessionScore: scored,
    };
  }
  return { phase: 'SETUP', freeAnalyses, features, settings, lastClosingCapital };
};

export const startSession = async (user, input) => {
  const entitlement = await getEntitlement(user.id);
  if (freeAnalysesView(entitlement).paywalled) throw errors.paywall();

  const lock = await findActiveSafetyLock(user.id);
  if (lock) throw errors.safetyLocked(lock.until);

  const settings = await getRiskSettings(user.id);
  const baseAmount = input.firstTradeAmount ?? baseTradeAmount(input.startingCapital, settings.firstTradePct);
  if (baseAmount > input.startingCapital) throw ApiError.validation('Trade amount cannot be more than your capital.');

  try {
    await createSession(user.id, {
      startingCapital: input.startingCapital,
      target: input.target,
      minPayoutPct: input.minPayoutPct,
      baseAmount,
      dailyLossLimitPct: settings.dailyLossLimitPct,
      dailyLossLimitAmount: dailyLossLimitAmount(input.startingCapital, settings.dailyLossLimitPct),
      consecutiveLossLimit: settings.consecutiveLossLimit,
      recoveryExtraPct: settings.recoveryExtraPct,
      profitReinvestPct: settings.profitReinvestPct,
      maxTradePct: settings.maxTradePct,
      accuracyFloorPct: settings.accuracyFloorPct,
      accuracyMinTrades: settings.accuracyMinTrades,
      accuracyExtraLosses: settings.accuracyExtraLosses,
      profitProtectStartPct: settings.profitProtectStartPct,
      profitGivebackPct: settings.profitGivebackPct,
      profitPeakTrades: settings.profitPeakTrades,
      profitPeakMinutes: settings.profitPeakMinutes,
      profitExtraLosses: settings.profitExtraLosses,
      profitLossStreak: settings.profitLossStreak,
      profitWarnPoints: settings.profitWarnPoints,
      profitStopPoints: settings.profitStopPoints,
    });
  } catch (error) {
    if (error.code === DUPLICATE_KEY) throw errors.alreadyActive();
    throw error;
  }
  return getDashboard(user);
};

export const recordTrade = async (user, input) => {
  // Fetched before the transaction opens, so no network call happens inside it.
  const minTradeAmount = await minTradeAmountNow();

  const outcome = await withTransaction(async (db) => {
    const session = await lockActiveSession(user.id, db);
    if (!session) throw errors.noActiveSession();
    if (session.status !== 'ACTIVE') throw stoppedError(session);

    const entitlement = await getEntitlement(user.id, db);
    if (freeAnalysesView(entitlement).paywalled) throw errors.paywall();

    const trades = await listTrades(session.id, db);
    const before = computeSessionStats({ trades, startingCapital: session.startingCapital, target: session.target });
    if (input.amount > before.currentCapital) throw ApiError.validation('Trade amount cannot be more than your current capital.');

    // Hard rule: a single trade may never risk more than the remaining loss protection.
    const { remaining } = evaluateProtection({ netPnl: before.netPnl, limitAmount: session.dailyLossLimitAmount });
    if (input.amount > remaining) {
      throw new ApiError('AMOUNT_EXCEEDS_PROTECTION', 'This amount is more than your remaining loss protection, so it cannot be placed.', 422, {
        remaining,
      });
    }

    // Hard rule: once Profit Protection has armed, a trade may never risk more than the profit made so far.
    const profitFloorCapBefore = profitFloorCapFor(profitProtectionFor({ session, trades }));
    if (profitFloorCapBefore !== null && input.amount > profitFloorCapBefore) {
      throw new ApiError(
        'AMOUNT_EXCEEDS_PROFIT_FLOOR',
        "This amount could turn today's session into a loss after reaching a strong profit point. It cannot be placed — try a smaller amount.",
        422,
        { cap: profitFloorCapBefore },
      );
    }

    const payoutPct = input.result === 'WIN' ? resolvePayout(session.minPayoutPct, input.actualPayoutPct) : session.minPayoutPct;
    const trade = await insertTrade(
      {
        sessionId: session.id,
        userId: user.id,
        seq: trades.length + 1,
        result: input.result,
        amount: input.amount,
        payoutPct,
        pnl: tradePnl({ result: input.result, amount: input.amount, payoutPct }),
        // Pair, timeframe and OTC are recorded for every plan; only the Insights tabs that show them are gated.
        pair: input.pair ?? null,
        isOtc: Boolean(input.isOtc),
        timeframe: input.timeframe ?? null,
      },
      db,
    );
    await incrementAnalysesUsed(user.id, db);

    const allTrades = [...trades, trade];
    const stats = computeSessionStats({ trades: allTrades, startingCapital: session.startingCapital, target: session.target });
    const { limitReached } = evaluateProtection({ netPnl: stats.netPnl, limitAmount: session.dailyLossLimitAmount, minTradeAmount });
    const profitGuardAfter = profitProtectionFor({ session, trades: allTrades });
    const profitFloorCapAfter = profitFloorCapFor(profitGuardAfter);
    const profitFloorExhausted = profitFloorCapAfter !== null && profitFloorCapAfter < minTradeAmount;

    let targetReached = false;
    let accuracyStopped = false;
    let profitProtected = false;
    let milestone = null;
    if (limitReached) {
      await markLimitReached(session.id, await lockEnd(db), db);
      await upsertDailyStat({ session, stats, limitReached: true }, db);
    } else if (isTargetReached(stats.targetAchievedPct)) {
      // 100% of the target: trading stops and locks for a cooling-off period to protect the profit.
      await markTargetReached(session.id, await lockEnd(db), db);
      await upsertDailyStat({ session, stats, limitReached: false }, db);
      targetReached = true;
    } else if (profitGuardAfter.stage === PROFIT_STAGE.STOP || profitFloorExhausted) {
      // Good profit and then kept losing after the warning (or the cushion ran out): close and keep what is left.
      await upsertDailyStat({ session, stats, limitReached: false }, db);
      await closeSession(session.id, db);
      await lockAfterClose(session.id, await lockEnd(db), 'PROFIT_PROTECTION', db);
      profitProtected = true;
    } else if (
      evaluateAccuracyGuard({
        trades: allTrades,
        floorPct: session.accuracyFloorPct,
        minTrades: session.accuracyMinTrades,
        extraLosses: session.accuracyExtraLosses,
      }).stage === ACCURACY_STAGE.STOP
    ) {
      // Accuracy stayed below the floor after the warnings: close the day, even if still in profit.
      await upsertDailyStat({ session, stats, limitReached: false }, db);
      await closeSession(session.id, db);
      await lockAfterClose(session.id, await lockEnd(db), 'ACCURACY_GUARD', db);
      accuracyStopped = true;
    } else {
      milestone = milestoneCrossed(stats.targetAchievedPct, session.lastMilestonePct);
      if (milestone) await setLastMilestone(session.id, milestone, db);
    }
    return { trade, limitReached, targetReached, accuracyStopped, profitProtected, milestone };
  });

  return {
    ...(await getDashboard(user)),
    lastTrade: outcome.trade,
    limitJustReached: outcome.limitReached,
    targetJustReached: outcome.targetReached,
    accuracyJustStopped: outcome.accuracyStopped,
    profitJustProtected: outcome.profitProtected,
    milestoneJustReached: outcome.milestone,
  };
};

/**
 * Changes the session's minimum payout mid-session. Only future recommendations use it;
 * recorded trades keep the payout they were saved with, so past analytics never change.
 */
export const changeMinPayout = async (user, minPayoutPct) => {
  await withTransaction(async (db) => {
    const session = await lockActiveSession(user.id, db);
    if (!session) throw errors.noActiveSession();
    if (session.status !== 'ACTIVE') throw stoppedError(session);
    await updateMinPayout(session.id, minPayoutPct, db);
  });
  return getDashboard(user);
};

/**
 * Closes the session. With `lock: true` the user is voluntarily stopping at a target milestone
 * (50% or more, below 100%), so the next hours are locked. The lock is enforced server-side.
 */
export const finishSession = (user, { lock = false } = {}) =>
  withTransaction(async (db) => {
    const session = await lockActiveSession(user.id, db);
    if (!session) throw errors.noActiveSession();

    const trades = await listTrades(session.id, db);
    const stats = computeSessionStats({ trades, startingCapital: session.startingCapital, target: session.target });
    if (lock && !(session.status === 'ACTIVE' && canStopAtMilestone(stats.targetAchievedPct))) throw errors.milestoneNotReached();

    await upsertDailyStat({ session, stats, limitReached: session.status === 'LIMIT_REACHED' }, db);
    await closeSession(session.id, db);
    if (lock) await lockAfterClose(session.id, await lockEnd(db), 'TARGET_MILESTONE', db);
    return { stats, session };
  });
