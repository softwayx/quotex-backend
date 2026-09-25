import {
  computeOutstandingLoss,
  computeSessionStats,
  evaluateAccuracyGuard,
  evaluateProfitProtection,
  evaluateProtection,
  percentOf,
  profitFloorCapFor,
  recommendNextTrade,
} from '../core/index.js';
import { freeAnalysesView } from '../entitlements/entitlements.js';

export { profitFloorCapFor };

/** Profit protection for a session's trades. Off (stage OK) for sessions that have no snapshot of the settings. */
export const profitProtectionFor = ({ session, trades, now = null }) =>
  evaluateProfitProtection({
    trades: trades.map((trade) => ({ result: trade.result, pnl: trade.pnl, at: trade.createdAt })),
    target: session.target,
    now,
    settings: {
      startPct: session.profitProtectStartPct ?? 0,
      givebackPct: session.profitGivebackPct ?? 0,
      lossStreak: session.profitLossStreak ?? 0,
      warnPoints: session.profitWarnPoints ?? 0,
      stopPoints: session.profitStopPoints ?? 0,
      peakTrades: session.profitPeakTrades ?? 0,
      peakMinutes: session.profitPeakMinutes ?? 0,
      extraLosses: session.profitExtraLosses ?? 0,
    },
  });

/** Builds everything the live tracker needs from a session and its trades. */
export const buildSessionView = ({ session, trades, entitlement, minTradeAmount = 0, now = new Date() }) => {
  const stats = computeSessionStats({ trades, startingCapital: session.startingCapital, target: session.target });
  const outstandingLoss = computeOutstandingLoss(trades);
  const protection = evaluateProtection({ netPnl: stats.netPnl, limitAmount: session.dailyLossLimitAmount, minTradeAmount });
  const freeAnalyses = freeAnalysesView(entitlement, now);
  const locked = session.status !== 'ACTIVE' || protection.limitReached;

  // Computed before the recommendation so a live warning can hold the trade size steady.
  const accuracyGuard = evaluateAccuracyGuard({
    trades,
    floorPct: session.accuracyFloorPct ?? 0,
    minTrades: session.accuracyMinTrades ?? 0,
    extraLosses: session.accuracyExtraLosses ?? 0,
  });
  const profitGuard = profitProtectionFor({ session, trades, now });
  const cautious = accuracyGuard.stage !== 'OK' || profitGuard.stage !== 'OK';
  const profitFloorCap = profitFloorCapFor(profitGuard);

  const recommendation =
    locked || freeAnalyses.paywalled || stats.currentCapital <= 0
      ? null
      : recommendNextTrade({
          capital: stats.currentCapital,
          baseAmount: session.baseAmount,
          outstandingLoss,
          consecutiveLosses: stats.currentLossStreak,
          payoutPct: session.minPayoutPct,
          protectionRemaining: protection.remaining,
          profitFloorCap: profitFloorCap ?? Infinity,
          settings: {
            consecutiveLossLimit: session.consecutiveLossLimit,
            recoveryExtraPct: session.recoveryExtraPct,
            profitReinvestPct: session.profitReinvestPct,
            maxTradePct: session.maxTradePct,
          },
          sessionProfit: Math.max(0, stats.netPnl),
          targetRemaining: stats.targetRemaining,
          minAmount: minTradeAmount,
          cautious,
        });

  return {
    session,
    stats,
    outstandingLoss,
    protection: {
      ...protection,
      limitAmount: session.dailyLossLimitAmount,
      usedPct: percentOf(Math.max(0, session.dailyLossLimitAmount - protection.remaining), session.dailyLossLimitAmount),
    },
    profitFloorCap,
    recommendation,
    guard: accuracyGuard,
    profitGuard,
    freeAnalyses,
    trades: trades.slice(-10).reverse(),
  };
};
