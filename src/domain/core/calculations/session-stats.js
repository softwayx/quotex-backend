import { percentOf, round2 } from './money.js';

/**
 * Aggregate stats for a session. `trades` are in chronological order and each
 * carries a signed `pnl` and a `result` of 'WIN' | 'LOSS'.
 */
export const computeSessionStats = ({ trades, startingCapital, target }) => {
  let wins = 0;
  let losses = 0;
  let totalProfit = 0;
  let totalLoss = 0;
  let winStreak = 0;
  let lossStreak = 0;
  let longestWinStreak = 0;
  let longestLossStreak = 0;
  let capital = startingCapital;
  let peak = startingCapital;
  let maxDrawdown = 0;

  for (const trade of trades) {
    if (trade.result === 'WIN') {
      wins += 1;
      totalProfit += trade.pnl;
      winStreak += 1;
      lossStreak = 0;
    } else {
      losses += 1;
      totalLoss += Math.abs(trade.pnl);
      lossStreak += 1;
      winStreak = 0;
    }
    longestWinStreak = Math.max(longestWinStreak, winStreak);
    longestLossStreak = Math.max(longestLossStreak, lossStreak);
    capital += trade.pnl;
    peak = Math.max(peak, capital);
    maxDrawdown = Math.max(maxDrawdown, peak - capital);
  }

  const totalTrades = wins + losses;
  const netPnl = round2(totalProfit - totalLoss);

  return {
    totalTrades,
    wins,
    losses,
    winRate: percentOf(wins, totalTrades),
    lossRate: percentOf(losses, totalTrades),
    totalProfit: round2(totalProfit),
    totalLoss: round2(totalLoss),
    netPnl,
    currentCapital: round2(capital),
    currentWinStreak: winStreak,
    currentLossStreak: lossStreak,
    longestWinStreak,
    longestLossStreak,
    maxDrawdown: round2(maxDrawdown),
    targetRemaining: round2(Math.max(0, target - netPnl)),
    targetAchievedPct: percentOf(Math.max(0, netPnl), target),
  };
};

/** Outstanding loss to recover: losses add to it, wins reduce it (floored at 0). */
export const computeOutstandingLoss = (trades) =>
  round2(trades.reduce((owed, trade) => Math.max(0, owed - trade.pnl), 0));
