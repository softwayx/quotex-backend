import { HIGH_RISK_TRADE_PCT } from '../constants.js';
import { percentOf, round2 } from './money.js';
import { profitFor } from './payout.js';

/** Pure simulation. Never touches session data or the free-trade allowance. */
export const simulateTrade = ({
  capital,
  amount,
  payoutPct,
  previousLoss = 0,
  target = 0,
  achieved = 0,
}) => {
  const profit = profitFor(amount, payoutPct);
  const remaining = Math.max(0, target - achieved);
  const riskPct = percentOf(amount, capital);

  return {
    riskPct,
    isHighRisk: riskPct >= HIGH_RISK_TRADE_PCT,
    win: {
      profit,
      newCapital: round2(capital + profit),
      targetRemaining: round2(Math.max(0, remaining - profit)),
      recoversPreviousLoss: previousLoss > 0 && profit >= previousLoss,
      extraAfterRecovery: previousLoss > 0 ? round2(Math.max(0, profit - previousLoss)) : 0,
    },
    loss: {
      loss: round2(amount),
      newCapital: round2(capital - amount),
      targetRemaining: round2(remaining + amount),
    },
  };
};
