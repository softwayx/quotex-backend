import { round2 } from './money.js';
import { evaluateAccuracyGuard } from '../rules/accuracy-guard.js';
import { evaluateProfitProtection, profitFloorCapFor } from '../rules/profit-protection.js';
import { evaluateProtection } from '../rules/safety-lock.js';
import { recommendNextTrade } from './recommendation.js';
import { computeOutstandingLoss, computeSessionStats } from './session-stats.js';

/** Fewer trades than this in one bucket and the row is marked "few trades". */
export const BEHAVIOUR_MIN_TRADES = 5;
/** A session needs this many trades before it gets a discipline score. */
export const SCORE_MIN_TRADES = 3;

const TF_SECONDS = { '5s': 5, '10s': 10, '15s': 15, '30s': 30, '1m': 60, '2m': 120, '3m': 180, '5m': 300, '10m': 600, '15m': 900, '30m': 1800, '1h': 3600, '4h': 14400 };

export const QUICK_GAP_SECONDS = 60;
export const WAITED_GAP_SECONDS = 180;
const GAP_BUCKETS = [
  { key: 'Under 30 sec', max: 30 },
  { key: '30 sec to 2 min', max: 120 },
  { key: '2 to 5 min', max: 300 },
  { key: '5 to 15 min', max: 900 },
  { key: 'Over 15 min', max: Infinity },
];
const FATIGUE_BUCKETS = [
  { key: 'Trades 1 to 5', from: 1, to: 5 },
  { key: 'Trades 6 to 10', from: 6, to: 10 },
  { key: 'Trades 11 to 15', from: 11, to: 15 },
  { key: 'Trade 16 and more', from: 16, to: Infinity },
];

const ms = (value) => new Date(value).getTime();

/**
 * Seconds the trader waited before each trade (except the first of a session). The time stored is
 * when the result was recorded, so when the timeframe is known the trade's start is estimated as
 * `recorded time - timeframe`. `afterLoss` says whether the previous trade was a loss.
 */
export const tradeGaps = (trades) =>
  trades.slice(1).map((trade, index) => {
    const previous = trades[index];
    const timeframe = TF_SECONDS[trade.timeframe] ?? 0;
    const raw = (ms(trade.at) - timeframe * 1000 - ms(previous.at)) / 1000;
    return { trade, gap: Math.max(0, raw), afterLoss: previous.result === 'LOSS', estimated: !timeframe };
  });

const row = (key) => ({ key, trades: 0, wins: 0, losses: 0, netPnl: 0 });
const add = (target, trade) => {
  target.trades += 1;
  if (trade.result === 'WIN') target.wins += 1;
  else target.losses += 1;
  target.netPnl += trade.pnl;
};
const finish = (r) => ({
  ...r,
  netPnl: round2(r.netPnl),
  winRatePct: r.trades ? round2((r.wins / r.trades) * 100) : 0,
  small: r.trades < BEHAVIOUR_MIN_TRADES,
});

const settingsOf = (session) => ({
  consecutiveLossLimit: session.consecutiveLossLimit,
  recoveryExtraPct: session.recoveryExtraPct,
  profitReinvestPct: session.profitReinvestPct,
  maxTradePct: session.maxTradePct,
});

/** Profit Protection + Accuracy Guard state for the trades taken so far (pure replay, no DB). */
const guardStateAt = (session, before) => {
  const accuracy = evaluateAccuracyGuard({
    trades: before,
    floorPct: session.accuracyFloorPct ?? 0,
    minTrades: session.accuracyMinTrades ?? 0,
    extraLosses: session.accuracyExtraLosses ?? 0,
  });
  const profit = evaluateProfitProtection({
    trades: before,
    target: session.target,
    settings: {
      startPct: session.profitProtectStartPct ?? 0,
      givebackPct: session.profitGivebackPct ?? 0,
      lossStreak: session.profitLossStreak ?? 0,
      peakTrades: session.profitPeakTrades ?? 0,
      peakMinutes: session.profitPeakMinutes ?? 0,
      extraLosses: session.profitExtraLosses ?? 0,
      warnPoints: session.profitWarnPoints ?? 0,
      stopPoints: session.profitStopPoints ?? 0,
    },
  });
  return {
    cautious: accuracy.stage !== 'OK' || profit.stage !== 'OK',
    profitFloorCap: profitFloorCapFor(profit) ?? Infinity,
  };
};

/** What the tool would have suggested before each trade of the session, replayed from the trades. */
export const replayRecommendations = (session, trades) =>
  trades.map((trade, index) => {
    const before = trades.slice(0, index);
    const stats = computeSessionStats({ trades: before, startingCapital: session.startingCapital, target: session.target });
    const protection = evaluateProtection({ netPnl: stats.netPnl, limitAmount: session.dailyLossLimitAmount });
    const { cautious, profitFloorCap } = guardStateAt(session, before);
    return recommendNextTrade({
      capital: stats.currentCapital,
      baseAmount: session.baseAmount,
      outstandingLoss: computeOutstandingLoss(before),
      consecutiveLosses: stats.currentLossStreak,
      payoutPct: session.minPayoutPct,
      settings: settingsOf(session),
      protectionRemaining: protection.remaining,
      profitFloorCap,
      sessionProfit: Math.max(0, stats.netPnl),
      targetRemaining: stats.targetRemaining,
      cautious,
    }).amount;
  });

const ratio = (part, whole) => (whole > 0 ? part / whole : 1);

/**
 * Discipline score (0 to 100) for one finished or running session:
 *  25 followed the suggested amount, 20 no oversized trade after a loss, 15 waited after a loss,
 *  25 respected the warnings and limits, 5 filled in trade details, 10 did not over-trade.
 * If the plan cannot record trade details (`detailsAvailable: false`) those 5 points are given in full.
 * Returns null when the session is too short to judge.
 */
export const scoreSession = (session, { detailsAvailable = true } = {}) => {
  const trades = session.trades;
  if (trades.length < SCORE_MIN_TRADES) return null;

  const recs = replayRecommendations(session, trades);
  const gaps = tradeGaps(trades);

  // 1. Suggested amount: within 20% of what the tool suggested at that moment.
  const followed = trades.filter((trade, i) => Math.abs(trade.amount - recs[i]) <= recs[i] * 0.2 + 0.01).length;

  // 2 and 3. After a loss: not bigger than 20% over the suggestion, and waited at least a minute.
  const afterLoss = gaps.filter((g) => g.afterLoss);
  const oversized = afterLoss.filter((g) => {
    const i = trades.indexOf(g.trade);
    return g.trade.amount > recs[i] * 1.2 + 0.01;
  }).length;
  const rushed = afterLoss.filter((g) => g.gap < QUICK_GAP_SECONDS).length;

  // 4. Warnings and limits.
  const firstWarning = firstWarningIndex(session, trades);
  const tradesAfterWarning = firstWarning === -1 ? 0 : trades.length - 1 - firstWarning;
  let obey = 25;
  let obeyKey = 'OBEY_NONE_IGNORED';
  if (session.lockReason === 'LOSS_LIMIT') {
    obey = 0;
    obeyKey = 'OBEY_LOSS_LIMIT';
  } else if (session.lockReason === 'ACCURACY_GUARD' || session.lockReason === 'PROFIT_PROTECTION') {
    obey = 8;
    obeyKey = 'OBEY_CLOSED_AFTER_WARNING';
  } else if (tradesAfterWarning >= 2) {
    obey = 15;
    obeyKey = 'OBEY_KEPT_TRADING';
  }

  // 5. Details and 6. Pace.
  const detailed = trades.filter((trade) => trade.pair || trade.timeframe).length;
  const pace = trades.length <= 12 ? 10 : Math.max(0, 10 - (trades.length - 12) * (10 / 12));

  // `noteKey` + `noteVars` (not a baked string) so the UI can render each note bilingually, the same
  // way profit-protection/accuracy-guard reasons work — see i18n `behaviourNote.*`.
  const parts = [
    { key: 'size', label: 'Followed the suggested amount', max: 25, points: 25 * ratio(followed, trades.length), noteKey: 'SIZE', noteVars: { followed, total: trades.length } },
    {
      key: 'oversize',
      label: 'No oversized trade after a loss',
      max: 20,
      points: 20 * (afterLoss.length ? 1 - oversized / afterLoss.length : 1),
      noteKey: afterLoss.length ? 'OVERSIZE' : 'NO_AFTER_LOSS_TRADES',
      noteVars: { oversized, total: afterLoss.length },
    },
    {
      key: 'wait',
      label: 'Waited after a loss',
      max: 15,
      points: 15 * (1 - (afterLoss.length ? rushed / afterLoss.length : 0)),
      noteKey: afterLoss.length ? 'WAIT' : 'NO_AFTER_LOSS_TRADES',
      noteVars: { rushed, total: afterLoss.length },
    },
    { key: 'obey', label: 'Respected warnings and limits', max: 25, points: obey, noteKey: obeyKey, noteVars: {} },
    {
      key: 'details',
      label: 'Filled in trade details',
      max: 5,
      points: detailsAvailable ? 5 * ratio(detailed, trades.length) : 5,
      noteKey: detailsAvailable ? 'DETAILS' : 'DETAILS_OFF',
      noteVars: { detailed, total: trades.length },
    },
    { key: 'pace', label: 'Did not over-trade', max: 10, points: pace, noteKey: 'PACE', noteVars: { total: trades.length } },
  ].map((part) => ({ ...part, points: round2(part.points) }));

  const score = Math.round(parts.reduce((sum, part) => sum + part.points, 0));
  return { score, parts };
};

/** Index of the first trade after which any warning (accuracy or profit) was showing, or -1. */
const firstWarningIndex = (session, trades) => {
  for (let i = 1; i <= trades.length; i += 1) {
    const prefix = trades.slice(0, i);
    const accuracy = evaluateAccuracyGuard({
      trades: prefix,
      floorPct: session.accuracyFloorPct ?? 0,
      minTrades: session.accuracyMinTrades ?? 0,
      extraLosses: session.accuracyExtraLosses ?? 0,
    });
    const profit = evaluateProfitProtection({
      trades: prefix,
      target: session.target,
      settings: {
        startPct: session.profitProtectStartPct ?? 0,
        givebackPct: session.profitGivebackPct ?? 0,
        lossStreak: session.profitLossStreak ?? 0,
        peakTrades: session.profitPeakTrades ?? 0,
        peakMinutes: session.profitPeakMinutes ?? 0,
        extraLosses: session.profitExtraLosses ?? 0,
        warnPoints: session.profitWarnPoints ?? 0,
        stopPoints: session.profitStopPoints ?? 0,
      },
    });
    if (accuracy.stage !== 'OK' || profit.stage !== 'OK') return i - 1;
  }
  return -1;
};

const label = (score) => (score >= 85 ? 'Excellent' : score >= 70 ? 'Good' : score >= 50 ? 'Needs work' : 'At risk');

const median = (values) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/** Win rate by trade number across sessions, and the trade number after which it clearly falls (or null). */
const fatigueOf = (sessions) => {
  const fatigue = FATIGUE_BUCKETS.map((b) => row(b.key));
  for (const session of sessions) {
    session.trades.forEach((trade, index) => {
      const n = index + 1;
      add(fatigue[FATIGUE_BUCKETS.findIndex((bucket) => n >= bucket.from && n <= bucket.to)], trade);
    });
  }
  const rows = fatigue.map(finish);
  const first = rows[0];
  let suggestedLimit = null;
  if (first.trades >= BEHAVIOUR_MIN_TRADES * 2) {
    for (let i = 1; i < rows.length; i += 1) {
      if (rows[i].trades >= BEHAVIOUR_MIN_TRADES * 2 && rows[i].winRatePct <= first.winRatePct - 15) {
        suggestedLimit = FATIGUE_BUCKETS[i - 1].to;
        break;
      }
    }
  }
  return { rows, suggestedLimit };
};

/**
 * Behaviour analysis over several sessions (oldest first). Each session:
 * { id, startedAt, lockReason, target, startingCapital, baseAmount, minPayoutPct, dailyLossLimitAmount,
 *   ...settings snapshots, trades: [{ result, amount, pnl, timeframe, pair, at }] }.
 */
export const buildBehaviour = (sessions, options = {}) => {
  // ---- discipline
  const scored = sessions
    .map((session) => ({ session, scored: scoreSession(session, options) }))
    .filter((entry) => entry.scored)
    .map(({ session, scored: s }) => ({
      id: session.id,
      startedAt: session.startedAt,
      trades: session.trades.length,
      netPnl: round2(session.trades.reduce((sum, trade) => sum + trade.pnl, 0)),
      score: s.score,
      label: label(s.score),
      parts: s.parts,
    }));
  const average = scored.length ? Math.round(scored.reduce((sum, s) => sum + s.score, 0) / scored.length) : null;
  let streak = 0;
  for (let i = scored.length - 1; i >= 0 && scored[i].score >= 80; i -= 1) streak += 1;
  const lost = new Map();
  scored.forEach((s) => s.parts.forEach((p) => lost.set(p.key, (lost.get(p.key) ?? 0) + (p.max - p.points))));
  const costs = [...lost.entries()].sort((a, b) => b[1] - a[1]).filter(([, value]) => value > 1);
  const partLabel = Object.fromEntries((scored[0]?.parts ?? []).map((p) => [p.key, p.label]));
  const discipline = {
    sessions: scored,
    average,
    label: average === null ? null : label(average),
    streak,
    biggestCosts: costs.slice(0, 3).map(([key, value]) => ({ key, label: partLabel[key], pointsLost: round2(value / scored.length) })),
  };

  // ---- gaps between trades
  const allGaps = sessions.flatMap((session) => tradeGaps(session.trades));
  const buckets = GAP_BUCKETS.map((b) => row(b.key));
  for (const g of allGaps) add(buckets[GAP_BUCKETS.findIndex((b) => g.gap < b.max)], g.trade);
  const quick = row('Within 1 minute of a loss');
  const waited = row('3 minutes or more after a loss');
  const afterWin = row('After a win');
  for (const g of allGaps) {
    if (g.afterLoss && g.gap < QUICK_GAP_SECONDS) add(quick, g.trade);
    if (g.afterLoss && g.gap >= WAITED_GAP_SECONDS) add(waited, g.trade);
    if (!g.afterLoss) add(afterWin, g.trade);
  }
  const sessionPace = sessions
    .filter((session) => session.trades.length >= SCORE_MIN_TRADES)
    .map((session) => {
      const gaps = tradeGaps(session.trades).map((g) => g.gap);
      const span = (ms(session.trades.at(-1).at) - ms(session.trades[0].at)) / 3_600_000;
      const net = session.trades.reduce((sum, trade) => sum + trade.pnl, 0);
      return { net, medianGap: median(gaps), perHour: session.trades.length / Math.max(span, 0.25) };
    });
  const avg = (list, key) => (list.length ? round2(list.reduce((s, x) => s + x[key], 0) / list.length) : null);
  const winners = sessionPace.filter((s) => s.net > 0);
  const losers = sessionPace.filter((s) => s.net < 0);
  const gaps = {
    buckets: buckets.map(finish),
    quickAfterLoss: finish(quick),
    waitedAfterLoss: finish(waited),
    afterWin: finish(afterWin),
    compare: {
      profitable: { sessions: winners.length, medianGapSeconds: avg(winners, 'medianGap'), tradesPerHour: avg(winners, 'perHour') },
      losing: { sessions: losers.length, medianGapSeconds: avg(losers, 'medianGap'), tradesPerHour: avg(losers, 'perHour') },
    },
    hasEstimates: allGaps.some((g) => g.estimated),
  };

  // ---- patterns: tiredness curve and profit given back
  const { rows: fatigueRows, suggestedLimit } = fatigueOf(sessions);

  let peakTotal = 0;
  let finalTotal = 0;
  let affected = 0;
  let worst = null;
  for (const session of sessions) {
    let net = 0;
    let peak = 0;
    for (const trade of session.trades) {
      net += trade.pnl;
      peak = Math.max(peak, net);
    }
    if (peak > 0 && session.trades.length >= SCORE_MIN_TRADES) {
      peakTotal += peak;
      finalTotal += net;
      const given = peak - net;
      if (given > 0.005 * peak) {
        affected += 1;
        if (!worst || given > worst.given) worst = { id: session.id, startedAt: session.startedAt, peak: round2(peak), final: round2(net), given: round2(given) };
      }
    }
  }
  const patterns = {
    fatigue: fatigueRows,
    suggestedLimit,
    givenBack: {
      sessionsWithProfit: sessions.filter((s) => s.trades.length >= SCORE_MIN_TRADES).length,
      affectedSessions: affected,
      peakTotal: round2(peakTotal),
      finalTotal: round2(finalTotal),
      givenTotal: round2(Math.max(0, peakTotal - finalTotal)),
      givenPct: peakTotal > 0 ? round2(((peakTotal - finalTotal) / peakTotal) * 100) : 0,
      worst,
    },
  };

  return { discipline, gaps, patterns };
};

/** Rows of results grouped by a key, for trades that have that key. */
const groupBy = (trades, keyOf) => {
  const rows = new Map();
  for (const trade of trades) {
    const key = keyOf(trade);
    if (!key) continue;
    if (!rows.has(key)) rows.set(key, row(key));
    add(rows.get(key), trade);
  }
  return [...rows.values()].map(finish);
};

/** Time-of-day slot label (IST, 3-hour slots) for a recorded time. */
const slotOf = (at) => {
  const hour = new Date(new Date(at).getTime() + 5.5 * 3_600_000).getUTCHours();
  const start = Math.floor(hour / 3) * 3;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(start)}:00–${pad(start + 3)}:00`;
};

/**
 * What the live tips need to know about a trader, from finished sessions (oldest first). Small and
 * cheap to compute, so it can be refreshed after every trade.
 */
export const buildTipsProfile = (sessions) => {
  const trades = sessions.flatMap((session) => session.trades);
  const gaps = sessions.flatMap((session) => tradeGaps(session.trades));
  const quick = row('quick');
  const waited = row('waited');
  for (const g of gaps) {
    if (g.afterLoss && g.gap < QUICK_GAP_SECONDS) add(quick, g.trade);
    if (g.afterLoss && g.gap >= WAITED_GAP_SECONDS) add(waited, g.trade);
  }
  const wins = trades.filter((trade) => trade.result === 'WIN').length;
  return {
    trades: trades.length,
    winRatePct: trades.length ? round2((wins / trades.length) * 100) : 0,
    quickAfterLoss: finish(quick),
    waitedAfterLoss: finish(waited),
    fatigueLimit: fatigueOf(sessions).suggestedLimit,
    timeframes: groupBy(trades, (trade) => trade.timeframe),
    pairs: groupBy(trades, (trade) => trade.pair),
    slots: groupBy(trades, (trade) => slotOf(trade.at)),
  };
};

const TIP_MIN = 8; // trades needed on one item before a tip may talk about it
const MAX_TIPS = 2;

/**
 * Tips that apply right now, from the user's own history. `trades` are the current session's trades
 * (oldest first), `nowMs` the current time. They are information only: nothing here says what to trade.
 * Each tip is { id, kind, ...facts } and the wording is added by the caller.
 */
export const buildLiveTips = ({ profile, trades, nowMs }) => {
  if (!profile || profile.trades < TIP_MIN) return [];
  const tips = [];
  const last = trades.at(-1);

  // Waiting after a loss: only when the user's own results show that waiting has worked better.
  const { quickAfterLoss: quick, waitedAfterLoss: waited } = profile;
  if (last?.result === 'LOSS' && quick.trades >= BEHAVIOUR_MIN_TRADES && waited.trades >= BEHAVIOUR_MIN_TRADES && waited.winRatePct >= quick.winRatePct + 10) {
    tips.push({
      id: `wait-${trades.length}`,
      kind: 'WAIT',
      sinceSeconds: Math.max(0, (nowMs - ms(last.at)) / 1000),
      waitSeconds: WAITED_GAP_SECONDS,
      quickWinPct: quick.winRatePct,
      waitedWinPct: waited.winRatePct,
    });
  }

  // Tired: more trades in this session than where the user's win rate usually falls.
  if (profile.fatigueLimit && trades.length >= profile.fatigueLimit) {
    tips.push({ id: 'fatigue', kind: 'FATIGUE', count: trades.length, limit: profile.fatigueLimit });
  }

  // Timeframe: the one used in the last trades is weaker for this user than their usual results.
  const recentFrames = trades.slice(-3).map((trade) => trade.timeframe).filter(Boolean);
  if (recentFrames.length >= 2 && recentFrames.every((frame) => frame === recentFrames[0])) {
    const current = profile.timeframes.find((r) => r.key === recentFrames[0]);
    if (current && current.trades >= TIP_MIN && current.netPnl < 0 && current.winRatePct <= profile.winRatePct - 10) {
      const better = profile.timeframes
        .filter((r) => r.key !== current.key && r.trades >= TIP_MIN && r.netPnl > 0 && r.winRatePct >= current.winRatePct + 15)
        .sort((x, y) => y.winRatePct - x.winRatePct)[0];
      tips.push({ id: `tf-${current.key}`, kind: 'TIMEFRAME', frame: current.key, winPct: current.winRatePct, trades: current.trades, overallPct: profile.winRatePct, better: better ? { frame: better.key, winPct: better.winRatePct, trades: better.trades } : null });
    }
  }

  // Pair: the pair in the last trade has cost this user money before.
  if (last?.pair) {
    const current = profile.pairs.find((r) => r.key === last.pair);
    if (current && current.trades >= TIP_MIN && current.netPnl < 0 && current.winRatePct <= profile.winRatePct - 10) {
      tips.push({ id: `pair-${current.key}`, kind: 'PAIR', pair: current.key, winPct: current.winRatePct, trades: current.trades, netPnl: current.netPnl });
    }
  }

  // Time of day: the current slot has been a weak one.
  const slot = profile.slots.find((r) => r.key === slotOf(nowMs));
  if (slot && slot.trades >= TIP_MIN && slot.netPnl < 0 && slot.winRatePct <= profile.winRatePct - 10) {
    tips.push({ id: `slot-${slot.key}`, kind: 'SLOT', slot: slot.key, winPct: slot.winRatePct, trades: slot.trades, netPnl: slot.netPnl });
  }

  return tips.slice(0, MAX_TIPS);
};
