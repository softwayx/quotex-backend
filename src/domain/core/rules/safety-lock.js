import { round2 } from '../calculations/money.js';
import { SAFETY_LOCK_HOURS } from '../constants.js';

export const dailyLossLimitAmount = (startingCapital, dailyLossLimitPct) =>
  round2((startingCapital * dailyLossLimitPct) / 100);

/**
 * Loss protection is based on session NET P/L, not the sum of losing trades.
 * `minTradeAmount`, when given, is the smallest trade the platform would actually accept (for
 * example, the INR value of $1): once what's left can no longer cover even that, the limit counts
 * as reached, since there is no amount left the user could legally place anyway.
 */
export const evaluateProtection = ({ netPnl, limitAmount, minTradeAmount = 0 }) => {
  const remaining = round2(Math.max(0, limitAmount + Math.min(0, netPnl)));
  return { remaining, limitReached: remaining < Math.max(minTradeAmount, 0.01) };
};

const IST_OFFSET_MS = 5.5 * 3_600_000;
const DAY_MS = 86_400_000;

/** Index of the IST calendar day that contains the moment. */
const istDay = (ms) => Math.floor((ms + IST_OFFSET_MS) / DAY_MS);

/**
 * When a lock ends. It lasts at least `minHours`. If that still lands on the same IST day, trading opens
 * at the next 12:00 AM IST instead, so a lock never reopens later the same day. Locked at 11 PM, it opens
 * after `minHours` (not at 12 AM).
 */
export const safetyLockUntil = (reachedAt, minHours = SAFETY_LOCK_HOURS) => {
  const start = new Date(reachedAt).getTime();
  const earliest = start + minHours * 3_600_000;
  if (istDay(earliest) !== istDay(start)) return new Date(earliest);
  return new Date((istDay(start) + 1) * DAY_MS - IST_OFFSET_MS);
};

export const isSafetyLocked = (lockedUntil, now = new Date()) =>
  Boolean(lockedUntil) && new Date(lockedUntil).getTime() > now.getTime();
