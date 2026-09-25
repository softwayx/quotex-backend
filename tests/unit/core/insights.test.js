import { describe, expect, it } from '@jest/globals';
import { buildInsights, timeBucketLabel } from '../../../src/domain/core/index.js';

// 2026-09-20 06:30 UTC is 12:00 IST.
const at = (hourUtc, minute = 0) => new Date(Date.UTC(2026, 8, 20, hourUtc, minute));
const trade = (result, pnl, extra = {}) => ({ result, pnl, pair: null, timeframe: null, isOtc: false, at: at(6, 30), ...extra });

describe('insights', () => {
  it('buckets time of day in IST', () => {
    expect(timeBucketLabel(at(6, 30))).toBe('12:00–15:00');
    expect(timeBucketLabel(at(18, 29))).toBe('21:00–24:00');
  });

  it('finds the pair with the biggest loss and the best pair, ignoring tiny samples', () => {
    const trades = [
      ...Array.from({ length: 6 }, () => trade('LOSS', -100, { pair: 'EUR/USD' })),
      ...Array.from({ length: 2 }, () => trade('WIN', 80, { pair: 'EUR/USD' })),
      ...Array.from({ length: 6 }, () => trade('WIN', 80, { pair: 'GBP/JPY' })),
      trade('LOSS', -500, { pair: 'BTC/USD' }),
    ];
    const { highlights, byPair } = buildInsights(trades);
    expect(highlights.pair.worst.key).toBe('EUR/USD');
    expect(highlights.pair.worst.netPnl).toBe(-440);
    expect(highlights.pair.best.key).toBe('GBP/JPY');
    // BTC/USD lost the most in money terms but has only one trade, so it is not called out.
    expect(byPair.find((row) => row.key === 'BTC/USD').small).toBe(true);
  });

  it('splits OTC and regular using only trades with details', () => {
    const trades = [
      trade('WIN', 80, { pair: 'EUR/USD', isOtc: true }),
      trade('LOSS', -100, { pair: 'EUR/USD', isOtc: false }),
      trade('LOSS', -100), // no details, ignored for the market split
    ];
    const { byMarket, detailedTrades, totalTrades } = buildInsights(trades);
    expect(totalTrades).toBe(3);
    expect(detailedTrades).toBe(2);
    expect(byMarket.map((row) => row.key)).toEqual(['OTC', 'Regular']);
  });

  it('groups by timeframe and computes win rate', () => {
    const trades = [
      trade('WIN', 80, { timeframe: '1m' }),
      trade('LOSS', -100, { timeframe: '1m' }),
      trade('WIN', 80, { timeframe: '5m' }),
    ];
    const { byTimeframe } = buildInsights(trades);
    const oneMin = byTimeframe.find((row) => row.key === '1m');
    expect(oneMin.winRatePct).toBe(50);
    expect(oneMin.netPnl).toBe(-20);
  });

  it('has no highlights when there is not enough data', () => {
    const { highlights } = buildInsights([trade('LOSS', -100, { pair: 'EUR/USD' })]);
    expect(highlights.pair.worst).toBeNull();
    expect(highlights.pair.best).toBeNull();
  });
});
