import { percentOf, round2 } from './money.js';

/**
 * Aggregates trades across sessions for analytics.
 * Each trade: { result, amount, pnl, day: 'YYYY-MM-DD', at: Date|string } in chronological order.
 */
export const aggregatePeriod = (trades) => {
  const days = new Map();
  const curve = [];
  let wins = 0;
  let losses = 0;
  let totalProfit = 0;
  let totalLoss = 0;
  let amountSum = 0;
  let cumulative = 0;
  let peak = 0;
  let maxDrawdown = 0;

  for (const trade of trades) {
    const day = days.get(trade.day) ?? { day: trade.day, net: 0, trades: 0, wins: 0, losses: 0 };
    day.trades += 1;
    day.net += trade.pnl;
    amountSum += trade.amount;

    if (trade.result === 'WIN') {
      wins += 1;
      day.wins += 1;
      totalProfit += trade.pnl;
    } else {
      losses += 1;
      day.losses += 1;
      totalLoss += Math.abs(trade.pnl);
    }
    days.set(trade.day, day);

    cumulative += trade.pnl;
    peak = Math.max(peak, cumulative);
    maxDrawdown = Math.max(maxDrawdown, peak - cumulative);
    curve.push({ at: trade.at, day: trade.day, value: round2(cumulative) });
  }

  const daily = [...days.values()].map((d) => ({ ...d, net: round2(d.net) }));
  const totalTrades = wins + losses;

  return {
    daily,
    curve,
    totals: {
      totalTrades,
      wins,
      losses,
      winRate: percentOf(wins, totalTrades),
      lossRate: percentOf(losses, totalTrades),
      totalProfit: round2(totalProfit),
      totalLoss: round2(totalLoss),
      netPnl: round2(totalProfit - totalLoss),
      avgTradeAmount: totalTrades ? round2(amountSum / totalTrades) : 0,
      maxDrawdown: round2(maxDrawdown),
    },
  };
};
