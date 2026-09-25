import { TradingSession } from '../../models/index.js';
import { mapSession } from './mappers.js';

const OPEN = { $ne: 'CLOSED' };
const first = (doc) => (doc ? mapSession(doc) : null);

export const findActiveSession = async (userId, session) =>
  first(await TradingSession.findOne({ user_id: userId, status: OPEN }, null, { session }).sort({ started_at: -1 }).lean());

/** Write-locks the open session so concurrent trade requests on it run one after another. */
export const lockActiveSession = async (userId, session) => {
  const open = await TradingSession.findOne({ user_id: userId, status: OPEN }, '_id', { session }).sort({ started_at: -1 }).lean();
  if (!open) return null;
  return first(await TradingSession.findOneAndUpdate({ _id: open._id }, { $inc: { lock_seq: 1 } }, { returnDocument: 'after', session, lean: true }));
};

/** Only returns the session when it belongs to `userId`. */
export const findSessionById = async (id, userId, session) =>
  first(await TradingSession.findOne({ _id: id, user_id: userId }, null, { session }).lean());

/** Latest lock still in force (loss limit, target reached or voluntary stop), even after the session closed. */
export const findActiveSafetyLock = async (userId) => {
  const doc = await TradingSession.findOne({ user_id: userId, safety_locked_until: { $gt: new Date() } }, 'safety_locked_until lock_reason')
    .sort({ safety_locked_until: -1 })
    .lean();
  return doc ? { sessionId: doc._id, until: doc.safety_locked_until, reason: doc.lock_reason ?? 'LOSS_LIMIT' } : null;
};

export const createSession = async (userId, values) => {
  const [doc] = await TradingSession.create([
    {
      user_id: userId,
      starting_capital: values.startingCapital,
      target: values.target,
      min_payout_pct: values.minPayoutPct,
      base_amount: values.baseAmount,
      daily_loss_limit_pct: values.dailyLossLimitPct,
      daily_loss_limit_amount: values.dailyLossLimitAmount,
      consecutive_loss_limit: values.consecutiveLossLimit,
      recovery_extra_pct: values.recoveryExtraPct,
      profit_reinvest_pct: values.profitReinvestPct,
      max_trade_pct: values.maxTradePct,
      accuracy_floor_pct: values.accuracyFloorPct,
      accuracy_min_trades: values.accuracyMinTrades,
      accuracy_extra_losses: values.accuracyExtraLosses,
      profit_protect_start_pct: values.profitProtectStartPct,
      profit_giveback_pct: values.profitGivebackPct,
      profit_peak_trades: values.profitPeakTrades,
      profit_peak_minutes: values.profitPeakMinutes,
      profit_extra_losses: values.profitExtraLosses,
      profit_loss_streak: values.profitLossStreak,
      profit_warn_points: values.profitWarnPoints,
      profit_stop_points: values.profitStopPoints,
    },
  ]);
  return mapSession(doc.toObject());
};

const update = async (sessionId, set, session) =>
  first(await TradingSession.findOneAndUpdate({ _id: sessionId }, { $set: set }, { returnDocument: 'after', session, lean: true }));

export const markLimitReached = (sessionId, lockedUntil, session) =>
  update(sessionId, { status: 'LIMIT_REACHED', safety_locked_until: lockedUntil, lock_reason: 'LOSS_LIMIT' }, session);

/** 100% of the daily target reached: trading stops and locks. */
export const markTargetReached = (sessionId, lockedUntil, session) =>
  update(sessionId, { status: 'TARGET_REACHED', safety_locked_until: lockedUntil, lock_reason: 'TARGET_REACHED' }, session);

export const setLastMilestone = (sessionId, milestonePct, session) => update(sessionId, { last_milestone_pct: milestonePct }, session);

/** Voluntary stop (or a guard): keeps the session data but locks trading until `lockedUntil`. */
export const lockAfterClose = (sessionId, lockedUntil, reason, session) =>
  update(sessionId, { safety_locked_until: lockedUntil, lock_reason: reason }, session);

export const updateMinPayout = (sessionId, minPayoutPct, session) => update(sessionId, { min_payout_pct: minPayoutPct }, session);

export const closeSession = (sessionId, session) => update(sessionId, { status: 'CLOSED', closed_at: new Date() }, session);
