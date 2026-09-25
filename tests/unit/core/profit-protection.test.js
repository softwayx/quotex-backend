import { describe, expect, it } from '@jest/globals';
import { evaluateProfitProtection, profitFloorCapFor } from '../../../src/domain/core/index.js';

const settings = { startPct: 70, givebackPct: 15, lossStreak: 3, peakTrades: 8, peakMinutes: 30, extraLosses: 1, warnPoints: 2, stopPoints: 3 };
const base = new Date('2026-09-20T10:00:00Z').getTime();
// Trades one minute apart: [result, pnl]
const run = (list, extra = {}) =>
  evaluateProfitProtection({
    trades: list.map(([result, pnl], i) => ({ result, pnl, at: new Date(base + i * 60_000) })),
    target: 1000,
    settings,
    ...extra,
  });

const W = (pnl) => ['WIN', pnl];
const L = (pnl) => ['LOSS', -pnl];
const flat = (n) => Array.from({ length: n }, (_, i) => (i % 2 ? W(1) : L(1))); // never beats the 800 peak
const UP = [W(400), W(400)]; // 80% of the target

describe('profit protection', () => {
  it('stays quiet below the start level', () => {
    expect(run([W(300), W(300), L(50), L(50), L(50)]).stage).toBe('OK');
  });

  it('stays quiet while profit is growing', () => {
    expect(run([...UP, W(100)]).stage).toBe('OK');
  });

  it('a single loss is not a warning, even if it gives back 16% of the peak', () => {
    const r = run([...UP, L(130)]); // 800 -> 670
    expect(r.stage).toBe('OK');
  });

  it('two losses are not enough on their own to lock or even warn when the loss is small', () => {
    expect(run([...UP, L(30), L(30)]).stage).toBe('OK');
  });

  it('three small losses in a row is only one sign', () => {
    const r = run([...UP, L(20), L(20), L(20)]); // streak 3, give-back 7%
    expect(r.stage).toBe('OK');
    expect(r.points).toBe(1);
  });

  it('warns when signs add up: a big give-back (2 points) after two losses', () => {
    const r = run([...UP, L(130), L(130)]); // 800 -> 540 = 32.5% back
    expect(r.stage).toBe('WARN');
    expect(r.reasons).toContain('GIVEBACK');
  });

  it('warns when back-to-back losses come after many extra trades', () => {
    const r = run([...UP, ...flat(8), L(5), L(5), L(5)]); // trades + loss streak
    expect(r.stage).toBe('WARN');
    expect(r.reasons).toEqual(expect.arrayContaining(['LOSS_STREAK', 'TRADES']));
  });

  it('does not lock right after the warning', () => {
    const r = run([...UP, L(130), L(130)]);
    expect(r.stage).toBe('WARN');
  });

  it('locks when more losses follow the warning and the signs are still strong', () => {
    const r = run([...UP, L(130), L(130), L(60)]); // give-back 40%+, streak 3
    expect(r.stage).toBe('STOP');
    expect(r.net).toBe(480);
  });

  it('does not lock if the signs weakened after the warning', () => {
    // Warned with two big losses, then a win brings profit back close to the peak, then one small loss.
    const r = run([...UP, L(130), L(130), W(250), L(10)]);
    expect(r.stage).toBe('OK');
  });

  it('a new best point clears the warning', () => {
    const r = run([...UP, L(130), L(130), W(400)]);
    expect(r.stage).toBe('OK');
    expect(r.net).toBe(940);
  });

  it('idle time adds a sign', () => {
    const later = base + 60 * 60_000;
    const r = run([...UP, L(130)], { now: later }); // give-back 1 point + time 1 point
    expect(r.stage).toBe('WARN');
    expect(r.reasons).toContain('TIME');
  });

  it('idle time alone is not a warning', () => {
    const later = base + 60 * 60_000;
    expect(run([...UP, L(10)], { now: later }).stage).toBe('OK');
  });

  it('keeps warning once profit turns into an actual loss, instead of going quiet', () => {
    const r = run([...UP, L(500), L(400)]); // 800 -> 300 -> -100, deep into loss
    expect(r.stage).toBe('WARN');
    expect(r.net).toBe(-100);
    expect(r.reasons).toContain('GIVEBACK');
  });

  it('the warning threshold is a setting: at 1 point a single big loss already warns', () => {
    const r = run([...UP, L(130)], { settings: { ...settings, warnPoints: 1 } }); // give-back is 1 point
    expect(r.stage).toBe('WARN');
  });

  it('the lock threshold is a setting: at 2 points the lock comes sooner', () => {
    const r = run([...UP, L(130), L(130)], { settings: { ...settings, warnPoints: 2, stopPoints: 2, extraLosses: 0 + 1 } });
    expect(r.stage).toBe('WARN'); // warned only now, no loss since the warning yet
    const later = run([...UP, L(130), L(130), L(10)], { settings: { ...settings, stopPoints: 2 } });
    expect(later.stage).toBe('STOP');
  });

  it('is off when a setting is missing', () => {
    const r = evaluateProfitProtection({
      trades: [{ result: 'LOSS', pnl: -10, at: new Date(base) }],
      target: 1000,
      settings: { ...settings, lossStreak: 0 },
    });
    expect(r.stage).toBe('OK');
  });

  describe('armed / profit floor', () => {
    it('is not armed before reaching the start point', () => {
      expect(run([W(300), W(300)]).armed).toBe(false); // 600 < 700 threshold
    });
    it('arms once the peak reaches the start point, and stays armed after giving profit back', () => {
      const r = run([...UP, L(130), L(130)]); // 800 -> 540, warned, but still armed
      expect(r.armed).toBe(true);
    });
    it('stays armed even once a warning has cleared on a genuine recovery', () => {
      const r = run([...UP, L(130), L(130), W(250), L(10)]); // clears the WARN stage (see above)
      expect(r.stage).toBe('OK');
      expect(r.armed).toBe(true); // peak was reached once; that never un-happens
    });
  });
});

describe('profitFloorCapFor', () => {
  it('is null (not Infinity) when not armed', () => {
    expect(profitFloorCapFor({ armed: false, net: 0 })).toBe(null);
  });
  it('is the profit made so far, minus one rounding step, once armed', () => {
    expect(profitFloorCapFor({ armed: true, net: 800 })).toBe(795);
  });
  it('shrinks as profit is given back, floored at 0', () => {
    expect(profitFloorCapFor({ armed: true, net: 3 })).toBe(0); // 3 - 5 would be negative
    expect(profitFloorCapFor({ armed: true, net: -100 })).toBe(0); // armed but now at a loss
  });
});
