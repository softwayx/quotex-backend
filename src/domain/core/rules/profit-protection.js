import { AMOUNT_ROUNDING_STEP } from '../constants.js';
import { roundDownToStep } from '../calculations/money.js';

export const PROFIT_STAGE = Object.freeze({ OK: 'OK', WARN: 'WARN', STOP: 'STOP' });

const MIN_MS = 60_000;
/**
 * Profit protection. It only switches on once the session has reached `startPct`% of its target and is
 * still in profit. From then on it looks at SEVERAL signs together, never one loss on its own:
 *  - GIVEBACK      `givebackPct`% of the peak profit is gone (1 point), or twice that much (2 points)
 *  - LOSS_STREAK   `lossStreak` losing trades in a row (1 point)
 *  - TRADES        `peakTrades` trades taken since the best profit without beating it (1 point)
 *  - TIME          `peakMinutes` minutes since the best profit, with trades taken since (1 point)
 * A warning starts at `warnPoints` points (default 2, so one sign alone never warns). The session is closed only
 * if, after the warning, at least `extraLosses` more trades were lost AND the signs are still at `stopPoints`
 * points (default 3). A new best profit clears everything.
 *
 * `trades`: the session's trades in order, { result, pnl, at }. `now` (optional) lets the TIME sign show
 * a warning while the user is idle. A missing or zero setting turns the whole rule off.
 */
export const evaluateProfitProtection = ({ trades, target, settings, now = null }) => {
  const { startPct, givebackPct, lossStreak, peakTrades, peakMinutes, extraLosses, warnPoints, stopPoints } = settings;
  const enabled =
    target > 0 &&
    startPct > 0 &&
    givebackPct > 0 &&
    lossStreak > 0 &&
    peakTrades > 0 &&
    peakMinutes > 0 &&
    extraLosses > 0 &&
    warnPoints > 0 &&
    stopPoints > 0;
  const off = { stage: PROFIT_STAGE.OK, peak: 0, net: 0, givebackPct: 0, reasons: [], points: 0, tradesSincePeak: 0, armed: false };
  if (!enabled) return off;

  const threshold = (target * startPct) / 100;
  let net = 0;
  let peak = 0;
  let peakIndex = -1;
  let streak = 0;
  let warned = false;
  let lossesSinceWarning = 0;
  let signs = { reasons: [], points: 0 };

  /** The signs that are on for the state after trade `index`, judged at time `atMs`. */
  const signsAt = (index, atMs) => {
    if (peak < threshold) return { reasons: [], points: 0 };
    const reasons = [];
    let points = 0;
    const giveback = ((peak - net) / peak) * 100;
    const sincePeak = index - peakIndex;
    if (giveback >= givebackPct) {
      reasons.push('GIVEBACK');
      points += giveback >= givebackPct * 2 ? 2 : 1;
    }
    if (streak >= lossStreak) {
      reasons.push('LOSS_STREAK');
      points += 1;
    }
    if (sincePeak >= peakTrades) {
      reasons.push('TRADES');
      points += 1;
    }
    if (sincePeak > 0 && (atMs - new Date(trades[peakIndex].at).getTime()) / MIN_MS >= peakMinutes) {
      reasons.push('TIME');
      points += 1;
    }
    return { reasons, points };
  };

  trades.forEach((trade, index) => {
    net += trade.pnl;
    if (net > peak) {
      peak = net;
      peakIndex = index;
    }
    streak = trade.result === 'LOSS' ? streak + 1 : 0;

    signs = signsAt(index, new Date(trade.at).getTime());
    if (signs.points < warnPoints) {
      warned = false;
      lossesSinceWarning = 0;
    } else if (!warned) {
      warned = true;
      lossesSinceWarning = 0;
    } else if (trade.result === 'LOSS') {
      lossesSinceWarning += 1;
    }
  });

  // Idle user: enough time has passed since the best point, so the signs can add up without a new trade.
  if (!warned && now && trades.length) {
    const idle = signsAt(trades.length - 1, new Date(now).getTime());
    if (idle.points >= warnPoints) {
      warned = true;
      lossesSinceWarning = 0;
      signs = idle;
    }
  }

  const round = (value) => Math.round(value * 100) / 100;
  const stop = warned && lossesSinceWarning >= extraLosses && signs.points >= stopPoints;
  return {
    stage: !warned ? PROFIT_STAGE.OK : stop ? PROFIT_STAGE.STOP : PROFIT_STAGE.WARN,
    peak: round(peak),
    net: round(net),
    givebackPct: peak > 0 ? round(((peak - net) / peak) * 100) : 0,
    reasons: warned ? signs.reasons : [],
    points: signs.points,
    tradesSincePeak: peakIndex >= 0 ? trades.length - 1 - peakIndex : 0,
    // Has the session EVER reached the protection start point (peak only grows, so this never
    // reverts once true, even after a warning clears) — used to permanently cap future trade size
    // so a loss can never erase the profit already made, regardless of the current warn state.
    armed: peak >= threshold,
  };
};

/**
 * Once Profit Protection has ever armed (session reached its start point), the most a trade can
 * risk is the profit made so far minus a small rounding-step buffer — so even a full loss on the
 * capped amount leaves a strictly positive profit, never breakeven or a loss. `null` (not
 * `Infinity`) when not armed, so this stays safe to send straight into a JSON response.
 */
export const profitFloorCapFor = (profitGuard) =>
  profitGuard.armed ? Math.max(0, roundDownToStep(profitGuard.net - AMOUNT_ROUNDING_STEP, AMOUNT_ROUNDING_STEP)) : null;
