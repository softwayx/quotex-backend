import { describe, expect, it } from '@jest/globals';
import {
  aggregatePeriod,
  RECOMMENDED_SETTINGS,
  analyzePlan,
  baseTradeAmount,
  canChangeSettings,
  computeOutstandingLoss,
  computeSessionStats,
  dailyLossLimitAmount,
  evaluateProtection,
  lockPeriodEnd,
  milestoneCrossed,
  canStopAtMilestone,
  profitFor,
  recommendNextTrade,
  evaluateAccuracyGuard,
  recoveryTradeAmount,
  resolvePayout,
  simulateTrade,
  tradePnl,
} from '../../../src/domain/core/index.js';

const settings = RECOMMENDED_SETTINGS;

describe('payout', () => {
  it('computes profit and falls back to minimum payout', () => {
    expect(profitFor(200, 80)).toBe(160);
    expect(profitFor(200, 90)).toBe(180);
    expect(resolvePayout(80, undefined)).toBe(80);
    expect(resolvePayout(80, 85)).toBe(85);
  });
  it('signs trade pnl', () => {
    expect(tradePnl({ result: 'LOSS', amount: 200, payoutPct: 80 })).toBe(-200);
    expect(tradePnl({ result: 'WIN', amount: 200, payoutPct: 80 })).toBe(160);
  });
});

describe('accuracy guard', () => {
  const seq = (text) => [...text].map((c) => ({ result: c === 'W' ? 'WIN' : 'LOSS' }));
  const cfg = { floorPct: 60, minTrades: 10, extraLosses: 2 };
  it('is quiet before enough trades', () => {
    expect(evaluateAccuracyGuard({ trades: seq('LLLLLLLLL'), ...cfg }).stage).toBe('OK');
  });
  it('is quiet while accuracy is at or above the floor', () => {
    expect(evaluateAccuracyGuard({ trades: seq('WWWWWWLLLL'), ...cfg }).stage).toBe('OK');
  });
  it('warns when accuracy falls below the floor', () => {
    const r = evaluateAccuracyGuard({ trades: seq('WWWWWLLLLL'), ...cfg });
    expect(r.stage).toBe('WARN');
    expect(r.extraLossesLeft).toBe(2);
  });
  it('gives a final warning after one more loss, then stops after the second', () => {
    expect(evaluateAccuracyGuard({ trades: seq('WWWWWLLLLLL'), ...cfg }).stage).toBe('FINAL');
    expect(evaluateAccuracyGuard({ trades: seq('WWWWWLLLLLLL'), ...cfg }).stage).toBe('STOP');
  });
  it('a win in between does not reset the count while accuracy stays low', () => {
    expect(evaluateAccuracyGuard({ trades: seq('WWWWWLLLLLWL'), ...cfg }).stage).toBe('FINAL');
  });
  it('clears the warning when accuracy recovers to the floor', () => {
    expect(evaluateAccuracyGuard({ trades: seq('WWWWWLLLLLWWWWWW'), ...cfg }).stage).toBe('OK');
  });
  it('is off when the settings are missing', () => {
    expect(evaluateAccuracyGuard({ trades: seq('LLLLLLLLLLLL'), floorPct: 0, minTrades: 0, extraLosses: 0 }).stage).toBe('OK');
  });
});

describe('recommendation', () => {
  it('base amount is fixed % of capital', () => {
    expect(baseTradeAmount(10000, 2)).toBe(200);
  });
  it('recovery: 200 loss + 10% at 80% payout => 275', () => {
    expect(recoveryTradeAmount({ outstandingLoss: 200, extraPct: 10, payoutPct: 80 })).toBe(275);
  });
  it('recovery: 200 + 5% at 80% => 262.5 rounds up to 265', () => {
    expect(recoveryTradeAmount({ outstandingLoss: 200, extraPct: 5, payoutPct: 80 })).toBe(265);
  });
  it('stops escalating after consecutive-loss cap', () => {
    const rec = recommendNextTrade({
      capital: 9000, baseAmount: 200, outstandingLoss: 900,
      consecutiveLosses: 3, payoutPct: 80, settings,
    });
    expect(rec.amount).toBe(200);
    expect(rec.mode).toBe('RECOVERY_CAPPED');
  });
  it('cautious: a warning holds the amount at base instead of escalating recovery', () => {
    const rec = recommendNextTrade({
      capital: 11715.2, baseAmount: 230, outstandingLoss: 525,
      consecutiveLosses: 2, payoutPct: 80, settings, cautious: true,
    });
    expect(rec.amount).toBe(230);
    expect(rec.mode).toBe('CAUTIOUS');
  });
  it('cautious: does not reinvest profit growth either', () => {
    const rec = recommendNextTrade({
      capital: 10160, baseAmount: 200, outstandingLoss: 0, consecutiveLosses: 0,
      payoutPct: 80, settings, sessionProfit: 160, cautious: true,
    });
    expect(rec.amount).toBe(200);
    expect(rec.mode).toBe('BASE');
  });
  it('near the target it recommends only what one win needs', () => {
    const rec = recommendNextTrade({
      capital: 15000, baseAmount: 200, outstandingLoss: 0,
      consecutiveLosses: 0, payoutPct: 80, settings, targetRemaining: 34,
    });
    expect(rec.amount).toBe(45);
    expect(rec.mode).toBe('TARGET_NEAR');
  });
  it('never suggests less than the minimum amount', () => {
    const rec = recommendNextTrade({
      capital: 15000, baseAmount: 200, outstandingLoss: 0,
      consecutiveLosses: 0, payoutPct: 80, settings, targetRemaining: 5, minAmount: 84,
    });
    expect(rec.amount).toBe(84);
  });
  it('far from the target the amount is unchanged', () => {
    const rec = recommendNextTrade({
      capital: 15000, baseAmount: 200, outstandingLoss: 0,
      consecutiveLosses: 0, payoutPct: 80, settings, targetRemaining: 5000,
    });
    expect(rec.amount).toBe(200);
  });
  it('never recommends more than remaining loss protection', () => {
    const rec = recommendNextTrade({
      capital: 9000, baseAmount: 200, outstandingLoss: 700,
      consecutiveLosses: 2, payoutPct: 80, settings, protectionRemaining: 300,
    });
    expect(rec.amount).toBe(300);
    expect(rec.mode).toBe('PROTECTION_LIMITED');
  });
  it('never inflates the amount above what is actually left, even below the minimum', () => {
    // Recommending more than the remaining protection would recommend a trade the server refuses.
    const rec = recommendNextTrade({
      capital: 9000, baseAmount: 200, outstandingLoss: 700,
      consecutiveLosses: 2, payoutPct: 80, settings, protectionRemaining: 0.42, minAmount: 84,
    });
    expect(rec.amount).toBe(0);
    expect(rec.mode).toBe('PROTECTION_LIMITED');
  });
  it('never risks more than the profit floor cap, once Profit Protection has armed', () => {
    const rec = recommendNextTrade({
      capital: 10195, baseAmount: 200, outstandingLoss: 0, consecutiveLosses: 0,
      payoutPct: 80, settings, sessionProfit: 195, profitFloorCap: 150,
    });
    expect(rec.amount).toBe(150);
    expect(rec.mode).toBe('PROFIT_FLOOR_LIMITED');
  });
  it('the profit floor cap can force the amount to 0 when the cushion is gone', () => {
    const rec = recommendNextTrade({
      capital: 9000, baseAmount: 200, outstandingLoss: 0,
      consecutiveLosses: 0, payoutPct: 80, settings, profitFloorCap: 0,
    });
    expect(rec.amount).toBe(0);
    expect(rec.mode).toBe('PROFIT_FLOOR_LIMITED');
  });
  it('reinvests part of session profit after a win and keeps the rest aside', () => {
    const rec = recommendNextTrade({
      capital: 10160, baseAmount: 200, outstandingLoss: 0, consecutiveLosses: 0,
      payoutPct: 80, settings, sessionProfit: 160,
    });
    expect(rec.amount).toBe(280); // 200 + 50% of 160
    expect(rec.mode).toBe('WIN_REINVEST');
  });
  it('caps reinvested amount at max trade % of capital, not a fixed multiple of base', () => {
    const rec = recommendNextTrade({
      capital: 6417.3, baseAmount: 100, outstandingLoss: 0, consecutiveLosses: 0,
      payoutPct: 80, settings: { ...settings, maxTradePct: 10 }, sessionProfit: 1417.3,
    });
    expect(rec.amount).toBe(640); // 10% of 6417.30 rounded down; profit alone would allow 810
    expect(rec.mode).toBe('WIN_REINVEST_CAPPED');
  });
  it('keeps growing with profit until the cap', () => {
    const at = (sessionProfit) =>
      recommendNextTrade({
        capital: 10000 + sessionProfit, baseAmount: 100, outstandingLoss: 0, consecutiveLosses: 0,
        payoutPct: 80, settings, sessionProfit,
      }).amount;
    expect(at(80)).toBe(140);
    expect(at(200)).toBe(200);
    expect(at(400)).toBe(300);
  });
  it('does not reinvest when turned off or when a loss is owed', () => {
    const off = recommendNextTrade({
      capital: 10160, baseAmount: 200, outstandingLoss: 0, consecutiveLosses: 0,
      payoutPct: 80, settings: { ...settings, profitReinvestPct: 0 }, sessionProfit: 160,
    });
    expect(off.amount).toBe(200);
    const owed = recommendNextTrade({
      capital: 10160, baseAmount: 200, outstandingLoss: 200, consecutiveLosses: 1,
      payoutPct: 80, settings, sessionProfit: 160,
    });
    expect(owed.mode).toBe('RECOVERY');
  });
  it('never exceeds capital', () => {
    const rec = recommendNextTrade({
      capital: 100, baseAmount: 200, outstandingLoss: 0,
      consecutiveLosses: 0, payoutPct: 80, settings,
    });
    expect(rec.amount).toBe(100);
    expect(rec.mode).toBe('CAPITAL_LIMITED');
  });
});

describe('session stats', () => {
  const trades = [
    { result: 'LOSS', pnl: -200 },
    { result: 'WIN', pnl: 160 },
    { result: 'LOSS', pnl: -300 },
    { result: 'LOSS', pnl: -400 },
  ];
  it('aggregates correctly', () => {
    const s = computeSessionStats({ trades, startingCapital: 10000, target: 2000 });
    expect(s.netPnl).toBe(-740);
    expect(s.winRate).toBe(25);
    expect(s.currentLossStreak).toBe(2);
    expect(s.longestLossStreak).toBe(2);
    expect(s.currentCapital).toBe(9260);
  });
  it('outstanding loss shrinks on wins', () => {
    expect(computeOutstandingLoss([{ pnl: -200 }, { pnl: 220 }])).toBe(0);
    expect(computeOutstandingLoss([{ pnl: -200 }, { pnl: 160 }])).toBe(40);
  });
});

describe('safety lock', () => {
  it('uses net pnl: +500 then -800 is -300, not -800', () => {
    const limit = dailyLossLimitAmount(10000, 10);
    expect(evaluateProtection({ netPnl: -300, limitAmount: limit })).toEqual({ remaining: 700, limitReached: false });
  });
  it('reports remaining protection and reaches limit', () => {
    expect(evaluateProtection({ netPnl: -740, limitAmount: 1000 }).remaining).toBe(260);
    expect(evaluateProtection({ netPnl: -1000, limitAmount: 1000 }).limitReached).toBe(true);
  });
  it('counts the limit as reached once what remains cannot fit even the smallest real trade', () => {
    // 0.42 left is not literally 0, but no platform accepts a trade that small.
    const r = evaluateProtection({ netPnl: -999.58, limitAmount: 1000, minTradeAmount: 84 });
    expect(r.remaining).toBe(0.42);
    expect(r.limitReached).toBe(true);
  });
  it('does not reach the limit while enough remains for the smallest real trade', () => {
    const r = evaluateProtection({ netPnl: -900, limitAmount: 1000, minTradeAmount: 84 });
    expect(r.remaining).toBe(100);
    expect(r.limitReached).toBe(false);
  });
});

describe('settings lock', () => {
  const now = new Date('2026-09-19T00:00:00Z');
  const lockedUntil = lockPeriodEnd('DAYS_7', now);
  it('blocks protected changes during lock', () => {
    expect(canChangeSettings({ changedKeys: ['dailyLossLimitPct'], lockedUntil, now })).toBe(false);
  });
  it('allows flexible settings during lock', () => {
    expect(canChangeSettings({ changedKeys: ['firstTradePct', 'recoveryExtraPct'], lockedUntil, now })).toBe(true);
  });
  it('allows protected changes after lock ends', () => {
    const later = new Date('2026-09-27T00:00:00Z');
    expect(canChangeSettings({ changedKeys: ['consecutiveLossLimit'], lockedUntil, now: later })).toBe(true);
  });
});

describe('period stats', () => {
  it('aggregates per day and overall', () => {
    const trades = [
      { result: 'LOSS', amount: 200, pnl: -200, day: '2026-09-18', at: 1 },
      { result: 'WIN', amount: 275, pnl: 220, day: '2026-09-18', at: 2 },
      { result: 'WIN', amount: 200, pnl: 160, day: '2026-09-19', at: 3 },
    ];
    const r = aggregatePeriod(trades);
    expect(r.daily).toEqual([
      { day: '2026-09-18', net: 20, trades: 2, wins: 1, losses: 1 },
      { day: '2026-09-19', net: 160, trades: 1, wins: 1, losses: 0 },
    ]);
    expect(r.totals.netPnl).toBe(180);
    expect(r.totals.maxDrawdown).toBe(200);
    expect(r.totals.avgTradeAmount).toBe(225);
    expect(r.curve.map((p) => p.value)).toEqual([-200, 20, 180]);
  });
});

describe('target milestones', () => {
  it('reports the highest newly crossed milestone once', () => {
    expect(milestoneCrossed(30, 0)).toBe(null);
    expect(milestoneCrossed(52, 0)).toBe(50);
    expect(milestoneCrossed(55, 50)).toBe(null);
    expect(milestoneCrossed(72, 50)).toBe(70);
    expect(milestoneCrossed(75, 0)).toBe(70); // jumped past both: celebrate the higher one
    expect(milestoneCrossed(70, 70)).toBe(null);
  });
  it('100% is not a milestone (it is the target itself)', () => {
    expect(milestoneCrossed(100, 70)).toBe(null);
    expect(canStopAtMilestone(49)).toBe(false);
    expect(canStopAtMilestone(50)).toBe(true);
    expect(canStopAtMilestone(100)).toBe(false);
  });
});

describe('what-if & plan', () => {
  it('simulates win/loss and risk', () => {
    const r = simulateTrade({ capital: 9400, amount: 300, payoutPct: 80, previousLoss: 200, target: 2000, achieved: 600 });
    expect(r.win.profit).toBe(240);
    expect(r.win.newCapital).toBe(9640);
    expect(r.loss.newCapital).toBe(9100);
    expect(r.riskPct).toBe(3.19);
    expect(r.win.extraAfterRecovery).toBe(40);
    expect(r.win.targetRemaining).toBe(1160);
    expect(r.loss.targetRemaining).toBe(1700);
  });
  it('analyzes plan', () => {
    const p = analyzePlan({ startingCapital: 10000, target: 2000, payoutPct: 80, firstTradeAmount: 200 });
    expect(p.isHighTarget).toBe(true);
    expect(p.winsNeededForTarget).toBe(13);
  });
});
