import { describe, expect, it } from '@jest/globals';
import { buildBehaviour, replayRecommendations, scoreSession, tradeGaps } from '../../../src/domain/core/index.js';

const T0 = new Date('2026-09-20T10:00:00Z').getTime();
const at = (seconds) => new Date(T0 + seconds * 1000);

const baseSession = (over = {}) => ({
  id: 's1',
  startedAt: at(0),
  lockReason: null,
  target: 1000,
  startingCapital: 10000,
  baseAmount: 200,
  minPayoutPct: 80,
  dailyLossLimitAmount: 1000,
  consecutiveLossLimit: 3,
  recoveryExtraPct: 10,
  profitReinvestPct: 50,
  maxTradePct: 5,
  trades: [],
  ...over,
});
const trade = (result, amount, seconds, extra = {}) => ({
  result,
  amount,
  pnl: result === 'WIN' ? amount * 0.8 : -amount,
  at: at(seconds),
  pair: null,
  timeframe: null,
  ...extra,
});

/** Builds a session where every trade follows the tool's suggestion, `results` apart by `gap` seconds. */
const followed = (results, gap = 240) => {
  const session = baseSession();
  const trades = [];
  results.forEach((result, i) => {
    const probe = { ...session, trades: [...trades, trade('WIN', 0, 0)] };
    const amount = replayRecommendations(probe, probe.trades)[i];
    trades.push(trade(result, amount, i * gap, { pair: 'EUR/USD', timeframe: '1m' }));
  });
  return { ...session, trades };
};

describe('trade gaps', () => {
  it('uses the timeframe to estimate when the trade started', () => {
    const trades = [trade('LOSS', 200, 0), trade('WIN', 200, 300, { timeframe: '1m' })];
    const [g] = tradeGaps(trades);
    expect(g.gap).toBe(240); // 300s between results minus the 60s the trade ran
    expect(g.afterLoss).toBe(true);
    expect(g.estimated).toBe(false);
  });
  it('never returns a negative gap', () => {
    const [g] = tradeGaps([trade('WIN', 200, 0), trade('WIN', 200, 20, { timeframe: '5m' })]);
    expect(g.gap).toBe(0);
  });
});

describe('discipline score', () => {
  it('is null for a very short session', () => {
    expect(scoreSession(baseSession({ trades: [trade('WIN', 200, 0), trade('WIN', 280, 60)] }))).toBeNull();
  });

  it('is high when the tool suggestion is followed and the trader waits', () => {
    const r = scoreSession(followed(['WIN', 'LOSS', 'WIN', 'WIN', 'LOSS', 'WIN']));
    expect(r.score).toBeGreaterThanOrEqual(90);
  });

  it('does not take points for details when the plan cannot record them', () => {
    const session = followed(['WIN', 'LOSS', 'WIN', 'WIN', 'LOSS', 'WIN']);
    const noDetails = { ...session, trades: session.trades.map((trade) => ({ ...trade, pair: null, timeframe: null })) };
    expect(scoreSession(noDetails).parts.find((p) => p.key === 'details').points).toBe(0);
    expect(scoreSession(noDetails, { detailsAvailable: false }).parts.find((p) => p.key === 'details').points).toBe(5);
  });

  it('is low for oversized, rushed trades after losses that ended at the loss limit', () => {
    const trades = [trade('LOSS', 1000, 0), trade('LOSS', 1500, 10), trade('LOSS', 2000, 20), trade('LOSS', 2500, 30)];
    const r = scoreSession(baseSession({ trades, lockReason: 'LOSS_LIMIT' }));
    expect(r.score).toBeLessThan(35);
    const obey = r.parts.find((p) => p.key === 'obey');
    expect(obey.points).toBe(0);
    expect(obey.noteKey).toBe('OBEY_LOSS_LIMIT');
  });

  it('gives each part a noteKey + noteVars instead of a baked string, for bilingual rendering', () => {
    const r = scoreSession(followed(['WIN', 'LOSS', 'WIN', 'WIN', 'LOSS', 'WIN']));
    for (const part of r.parts) {
      expect(typeof part.noteKey).toBe('string');
      expect(typeof part.noteVars).toBe('object');
    }
    expect(r.parts.find((p) => p.key === 'size').noteVars).toEqual({ followed: expect.any(Number), total: 6 });
  });

  it('shares one noteKey between oversize and wait when there were no trades after a loss', () => {
    // Every trade wins, so there is never a trade "after a loss" to judge either part on.
    const r = scoreSession(followed(['WIN', 'WIN', 'WIN', 'WIN']));
    expect(r.parts.find((p) => p.key === 'oversize').noteKey).toBe('NO_AFTER_LOSS_TRADES');
    expect(r.parts.find((p) => p.key === 'wait').noteKey).toBe('NO_AFTER_LOSS_TRADES');
  });
});

describe('behaviour analysis', () => {
  it('compares quick and waited trades after a loss', () => {
    // Losses followed by quick losing trades, then losses followed by a wait and a win.
    const quickPart = [trade('LOSS', 200, 0), trade('LOSS', 200, 20), trade('LOSS', 200, 40)];
    const waitPart = [trade('LOSS', 200, 1000), trade('WIN', 200, 1300), trade('LOSS', 200, 1400), trade('WIN', 200, 1700)];
    const { gaps } = buildBehaviour([baseSession({ trades: [...quickPart, ...waitPart] })]);
    expect(gaps.quickAfterLoss.trades).toBe(2);
    expect(gaps.quickAfterLoss.wins).toBe(0);
    expect(gaps.waitedAfterLoss.trades).toBe(3);
    expect(gaps.waitedAfterLoss.wins).toBe(2);
    expect(gaps.buckets.reduce((s, b) => s + b.trades, 0)).toBe(6);
  });

  it('finds where the win rate falls with the number of trades', () => {
    const early = Array.from({ length: 10 }, (_, i) => trade(i % 5 === 4 ? 'LOSS' : 'WIN', 100, i * 300)); // 80% in trades 1 to 10
    const late = Array.from({ length: 10 }, (_, i) => trade(i < 2 ? 'WIN' : 'LOSS', 100, 3000 + i * 300)); // 20% in trades 11 to 20
    const one = baseSession({ trades: [...early, ...late] });
    const { patterns } = buildBehaviour([one, { ...one, id: 's2' }]); // two sessions give enough trades per bucket
    expect(patterns.suggestedLimit).toBe(10);
  });

  it('measures how much profit was given back', () => {
    const trades = [trade('WIN', 500, 0), trade('WIN', 500, 60), trade('LOSS', 200, 120), trade('LOSS', 200, 180)];
    const { patterns } = buildBehaviour([baseSession({ trades })]);
    expect(patterns.givenBack.affectedSessions).toBe(1);
    expect(patterns.givenBack.givenTotal).toBe(400);
    expect(patterns.givenBack.worst.peak).toBe(800);
  });

  it('averages the discipline score and finds a streak of good sessions', () => {
    const good = followed(['WIN', 'LOSS', 'WIN', 'WIN', 'LOSS', 'WIN']);
    const { discipline } = buildBehaviour([{ ...good, id: 'a' }, { ...good, id: 'b' }]);
    expect(discipline.sessions).toHaveLength(2);
    expect(discipline.streak).toBe(2);
    expect(discipline.average).toBeGreaterThanOrEqual(90);
  });
});
