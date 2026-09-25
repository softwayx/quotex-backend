/** Single source of truth for product defaults and fixed rules. */

export const TRADE_RESULT = Object.freeze({ WIN: 'WIN', LOSS: 'LOSS' });

export const RECOMMENDED_SETTINGS = Object.freeze({
  dailyLossLimitPct: 10,
  consecutiveLossLimit: 3,
  firstTradePct: 2,
  recoveryExtraPct: 10,
  profitReinvestPct: 50,
  maxTradePct: 5,
  accuracyFloorPct: 60,
  accuracyMinTrades: 10,
  accuracyExtraLosses: 2,
  profitProtectStartPct: 70,
  profitGivebackPct: 15,
  profitLossStreak: 3,
  profitWarnPoints: 2,
  profitStopPoints: 3,
  profitPeakTrades: 8,
  profitPeakMinutes: 30,
  profitExtraLosses: 1,
});

/** Settings that are time-locked once the user commits to them. */
export const PROTECTED_SETTING_KEYS = Object.freeze(['dailyLossLimitPct', 'consecutiveLossLimit', 'accuracyFloorPct', 'accuracyMinTrades', 'accuracyExtraLosses', 'profitProtectStartPct', 'profitGivebackPct', 'profitLossStreak', 'profitWarnPoints', 'profitStopPoints', 'profitPeakTrades', 'profitPeakMinutes', 'profitExtraLosses']);

/** Settings the user may change or reset at any time. */
export const FLEXIBLE_SETTING_KEYS = Object.freeze(['firstTradePct', 'recoveryExtraPct', 'profitReinvestPct', 'maxTradePct']);

export const LOCK_PERIODS = Object.freeze({
  DAY_1: { key: 'DAY_1', days: 1 },
  DAYS_7: { key: 'DAYS_7', days: 7 },
  MONTH_1: { key: 'MONTH_1', days: 30 },
});

/** Default shortest lock. The admin can change it. */
export const SAFETY_LOCK_HOURS = 6;
/** Share of the daily target at which the user is congratulated and may stop for the day. */
export const TARGET_MILESTONES = Object.freeze([50, 70]);
export const FREE_TRADE_ALLOWANCE = 10;
export const AMOUNT_ROUNDING_STEP = 5;
export const HIGH_TARGET_PCT = 20;
export const HIGH_RISK_TRADE_PCT = 10;
export const HISTORY_DAYS = 7;
