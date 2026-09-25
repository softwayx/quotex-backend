import { HIGH_TARGET_PCT } from '../constants.js';
import { percentOf } from './money.js';
import { profitFor } from './payout.js';

/** Insight for the Daily Setup screen. Informational only; never auto-raises amounts. */
export const analyzePlan = ({ startingCapital, target, payoutPct, firstTradeAmount }) => {
  const perWinProfit = profitFor(firstTradeAmount, payoutPct);
  const targetPct = percentOf(target, startingCapital);

  return {
    targetPct,
    firstTradePct: percentOf(firstTradeAmount, startingCapital),
    isHighTarget: targetPct >= HIGH_TARGET_PCT,
    winsNeededForTarget: perWinProfit > 0 ? Math.ceil(target / perWinProfit) : null,
  };
};
