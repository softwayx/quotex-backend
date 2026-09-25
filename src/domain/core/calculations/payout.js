import { round2 } from './money.js';

/** Profit for a winning trade. `payoutPct` is e.g. 80 for 80%. */
export const profitFor = (amount, payoutPct) => round2((amount * payoutPct) / 100);

/** Actual payout overrides the minimum payout; blank/invalid falls back to minimum. */
export const resolvePayout = (minPayoutPct, actualPayoutPct) =>
  Number.isFinite(actualPayoutPct) && actualPayoutPct > 0 ? actualPayoutPct : minPayoutPct;

/** Signed P/L of a recorded trade. */
export const tradePnl = ({ result, amount, payoutPct }) =>
  result === 'WIN' ? profitFor(amount, payoutPct) : -round2(amount);
