import { isProtectedLockActive, lockPeriodEnd } from '../core/index.js';
import ApiError from '../../utils/apiError.js';
import { getRecommendedSettings } from './recommendedSettings.js';
import { getRiskSettings, saveRiskSettings } from './riskSettings.js';

/** `recommended` comes from the admin-managed document, so a change there reaches every user. */
const toView = async (settings) => ({
  settings,
  recommended: await getRecommendedSettings(),
  protectedLocked: isProtectedLockActive(settings.protectedLockedUntil),
});

export const getSettingsView = async (userId) => toView(await getRiskSettings(userId));

/**
 * Flexible settings: editable and resettable at any time.
 * Reset clears the user's own values so they follow the recommendation (including future changes).
 */
export const saveFlexibleSettings = async (userId, input) => {
  const values = input.reset
    ? { firstTradePct: null, recoveryExtraPct: null, profitReinvestPct: null, maxTradePct: null }
    : {
        firstTradePct: input.firstTradePct,
        recoveryExtraPct: input.recoveryExtraPct,
        profitReinvestPct: input.profitReinvestPct,
        maxTradePct: input.maxTradePct,
      };
  return toView(await saveRiskSettings(userId, values));
};

/**
 * Protected settings: once committed they cannot be edited, reset or disabled
 * until the chosen lock period ends. This is the over-trading guard, so it is
 * enforced here on the server and never only in the UI.
 */
export const commitProtectedSettings = async (userId, input) => {
  const current = await getRiskSettings(userId);
  if (isProtectedLockActive(current.protectedLockedUntil)) {
    throw new ApiError('SETTINGS_LOCKED', 'These settings are locked until the lock period ends.', 423, {
      until: current.protectedLockedUntil,
    });
  }
  return toView(
    await saveRiskSettings(userId, {
      dailyLossLimitPct: input.dailyLossLimitPct,
      consecutiveLossLimit: input.consecutiveLossLimit,
      accuracyFloorPct: input.accuracyFloorPct,
      accuracyMinTrades: input.accuracyMinTrades,
      accuracyExtraLosses: input.accuracyExtraLosses,
      profitProtectStartPct: input.profitProtectStartPct,
      profitGivebackPct: input.profitGivebackPct,
      profitPeakTrades: input.profitPeakTrades,
      profitPeakMinutes: input.profitPeakMinutes,
      profitExtraLosses: input.profitExtraLosses,
      profitLossStreak: input.profitLossStreak,
      profitWarnPoints: input.profitWarnPoints,
      profitStopPoints: input.profitStopPoints,
      protectedLockedUntil: lockPeriodEnd(input.lockPeriod),
    }),
  );
};
