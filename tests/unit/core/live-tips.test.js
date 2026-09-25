import { describe, expect, it } from '@jest/globals';
import { buildBehaviour, buildLiveTips, buildTipsProfile } from '../../../src/domain/core/index.js';

const T0 = new Date('2026-09-10T10:00:00Z').getTime();
const at = (seconds) => new Date(T0 + seconds * 1000);
const session = (id, trades) => ({
  id,
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
  trades,
});
const t = (result, seconds, extra = {}) => ({ result, amount: 100, pnl: result === 'WIN' ? 80 : -100, at: at(seconds), pair: null, timeframe: null, ...extra });

/** History where quick trades after a loss lose and patient ones win, 1m loses and 5m wins, EUR/USD loses. */
const history = () => {
  const list = [];
  for (let s = 0; s < 4; s += 1) {
    const trades = [];
    let clock = 0;
    for (let i = 0; i < 6; i += 1) {
      // A loss, then a quick trade that loses.
      trades.push(t('LOSS', clock, { timeframe: '1m', pair: 'EUR/USD' }));
      clock += 20;
      trades.push(t('LOSS', clock, { timeframe: '1m', pair: 'EUR/USD' }));
      clock += 20;
      // A loss, then a patient trade that wins.
      trades.push(t('LOSS', clock, { timeframe: '5m', pair: 'GBP/JPY' }));
      clock += 600;
      trades.push(t('WIN', clock, { timeframe: '5m', pair: 'GBP/JPY' }));
      clock += 600;
      trades.push(t('WIN', clock, { timeframe: '5m', pair: 'GBP/JPY' }));
      clock += 600;
    }
    list.push(session(`s${s}`, trades));
  }
  return list;
};

describe('tips profile', () => {
  it('summarises quick and patient trades after a loss', () => {
    const p = buildTipsProfile(history());
    expect(p.quickAfterLoss.trades).toBeGreaterThanOrEqual(5);
    expect(p.waitedAfterLoss.trades).toBeGreaterThanOrEqual(5);
    expect(p.waitedAfterLoss.winRatePct).toBeGreaterThan(p.quickAfterLoss.winRatePct);
  });
});

describe('live tips', () => {
  const profile = buildTipsProfile(history());
  const now = T0 + 5 * 24 * 3_600_000;

  it('gives no tips without enough history', () => {
    expect(buildLiveTips({ profile: buildTipsProfile([]), trades: [t('LOSS', 0)], nowMs: now })).toEqual([]);
  });

  it('after a loss it tells the trader how long since the loss and what waiting has done', () => {
    const trades = [t('LOSS', 0)];
    const tips = buildLiveTips({ profile, trades, nowMs: at(0).getTime() + 24_000 });
    const wait = tips.find((tip) => tip.kind === 'WAIT');
    expect(wait.sinceSeconds).toBe(24);
    expect(wait.waitedWinPct).toBeGreaterThan(wait.quickWinPct);
  });

  it('does not talk about waiting after a win', () => {
    const tips = buildLiveTips({ profile, trades: [t('WIN', 0)], nowMs: at(30).getTime() });
    expect(tips.find((tip) => tip.kind === 'WAIT')).toBeUndefined();
  });

  it('warns when the recent timeframe has been a weak one and names a better one from their own data', () => {
    const trades = [t('WIN', 0, { timeframe: '1m' }), t('WIN', 100, { timeframe: '1m' }), t('WIN', 200, { timeframe: '1m' })];
    const tip = buildLiveTips({ profile, trades, nowMs: now }).find((x) => x.kind === 'TIMEFRAME');
    expect(tip.frame).toBe('1m');
    expect(tip.better.frame).toBe('5m');
  });

  it('warns about a pair that has cost money before', () => {
    const tip = buildLiveTips({ profile, trades: [t('WIN', 0, { pair: 'EUR/USD' })], nowMs: now }).find((x) => x.kind === 'PAIR');
    expect(tip.pair).toBe('EUR/USD');
    expect(tip.netPnl).toBeLessThan(0);
  });

  it('shows at most two tips', () => {
    const trades = [t('LOSS', 0, { timeframe: '1m', pair: 'EUR/USD' }), t('LOSS', 50, { timeframe: '1m', pair: 'EUR/USD' }), t('LOSS', 100, { timeframe: '1m', pair: 'EUR/USD' })];
    expect(buildLiveTips({ profile, trades, nowMs: at(100).getTime() + 10_000 }).length).toBeLessThanOrEqual(2);
  });

  it('the tiredness tip appears when the session is longer than where the win rate falls', () => {
    const early = Array.from({ length: 10 }, (_, i) => t(i % 5 === 4 ? 'LOSS' : 'WIN', i * 300));
    const late = Array.from({ length: 10 }, (_, i) => t(i < 2 ? 'WIN' : 'LOSS', 3000 + i * 300));
    const sessions = [session('a', [...early, ...late]), session('b', [...early, ...late])];
    const p = buildTipsProfile(sessions);
    expect(p.fatigueLimit).toBe(10);
    const current = Array.from({ length: 11 }, (_, i) => t('WIN', i * 60));
    expect(buildLiveTips({ profile: p, trades: current, nowMs: now }).some((tip) => tip.kind === 'FATIGUE')).toBe(true);
    expect(buildBehaviour(sessions).patterns.suggestedLimit).toBe(10);
  });
});
