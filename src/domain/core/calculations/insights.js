import { round2 } from './money.js';

/** A row needs at least this many trades before it can be called the "best" or "worst". */
export const INSIGHT_MIN_TRADES = 5;

const IST_OFFSET_MS = 5.5 * 3_600_000;
const BUCKET_HOURS = 3;

const emptyRow = (key) => ({ key, trades: 0, wins: 0, losses: 0, netPnl: 0 });

const finish = (row) => ({
  ...row,
  netPnl: round2(row.netPnl),
  winRatePct: row.trades ? round2((row.wins / row.trades) * 100) : 0,
  small: row.trades < INSIGHT_MIN_TRADES,
});

/** Groups trades by a key function. Trades whose key is null are skipped. */
const group = (trades, keyOf) => {
  const rows = new Map();
  for (const trade of trades) {
    const key = keyOf(trade);
    if (key === null || key === undefined) continue;
    const row = rows.get(key) ?? emptyRow(key);
    row.trades += 1;
    if (trade.result === 'WIN') row.wins += 1;
    else row.losses += 1;
    row.netPnl += trade.pnl;
    rows.set(key, row);
  }
  return [...rows.values()].map(finish);
};

/** IST hour bucket label such as "12:00–15:00". */
export const timeBucketLabel = (at) => {
  const hour = new Date(new Date(at).getTime() + IST_OFFSET_MS).getUTCHours();
  const start = Math.floor(hour / BUCKET_HOURS) * BUCKET_HOURS;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(start)}:00–${pad(start + BUCKET_HOURS)}:00`;
};

/** Worst = the most negative net P/L, best = the most positive. Only rows with enough trades count. */
const pickExtremes = (rows) => {
  const eligible = rows.filter((row) => !row.small);
  const worst = eligible.filter((row) => row.netPnl < 0).sort((a, b) => a.netPnl - b.netPnl)[0] ?? null;
  const best = eligible.filter((row) => row.netPnl > 0).sort((a, b) => b.netPnl - a.netPnl)[0] ?? null;
  return { worst, best };
};

const byName = (a, b) => a.key.localeCompare(b.key);

/**
 * Pro insights from a list of trades: { result, pnl, pair, timeframe, isOtc, at }.
 * Pair, timeframe and market only use trades where the trader recorded those details.
 * Time of day works for every trade because the time is always known.
 */
export const buildInsights = (trades) => {
  const detailed = trades.filter((trade) => trade.pair || trade.timeframe);

  const byPair = group(trades, (trade) => trade.pair ?? null).sort((a, b) => b.trades - a.trades);
  const byTimeframe = group(trades, (trade) => trade.timeframe ?? null).sort((a, b) => b.trades - a.trades);
  const byMarket = group(detailed, (trade) => (trade.isOtc ? 'OTC' : 'Regular')).sort(byName);
  const byTime = group(trades, (trade) => timeBucketLabel(trade.at)).sort(byName);

  return {
    totalTrades: trades.length,
    detailedTrades: detailed.length,
    byPair,
    byTimeframe,
    byMarket,
    byTime,
    highlights: {
      pair: pickExtremes(byPair),
      timeframe: pickExtremes(byTimeframe),
      time: pickExtremes(byTime),
    },
  };
};
