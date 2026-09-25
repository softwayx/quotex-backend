import { HISTORY_DAYS } from '../core/index.js';
import { DailyStat, TradingSession } from '../../models/index.js';
import { istDate, istSince } from '../../utils/dates.js';
import { mapDailyStat } from './mappers.js';

/** Writes (or refreshes) the compact summary for a session. Date is in IST. */
export const upsertDailyStat = ({ session, stats, limitReached }, dbSession) =>
  DailyStat.updateOne(
    { session_id: session.id },
    {
      $setOnInsert: {
        user_id: session.userId,
        stat_date: istDate(),
        starting_capital: session.startingCapital,
        target: session.target,
      },
      $set: {
        closing_capital: stats.currentCapital,
        total_trades: stats.totalTrades,
        wins: stats.wins,
        losses: stats.losses,
        total_profit: stats.totalProfit,
        total_loss: stats.totalLoss,
        net_pnl: stats.netPnl,
        max_drawdown: stats.maxDrawdown,
        longest_win_streak: stats.longestWinStreak,
        longest_loss_streak: stats.longestLossStreak,
        target_achieved_pct: stats.targetAchievedPct,
        limit_reached: limitReached,
      },
    },
    { upsert: true, session: dbSession },
  );

/** Newest session first, like `ORDER BY trading_sessions.started_at DESC` in the old app. */
const byStartedAtDesc = async (stats) => {
  const sessions = await TradingSession.find({ _id: { $in: stats.map((s) => s.session_id) } }, 'started_at', { withDeleted: true }).lean();
  const startedAt = new Map(sessions.map((s) => [s._id, new Date(s.started_at).getTime()]));
  return stats.sort((a, b) => (startedAt.get(b.session_id) ?? 0) - (startedAt.get(a.session_id) ?? 0));
};

export const listRecentDailyStats = async (userId, days = HISTORY_DAYS) =>
  (await byStartedAtDesc(await DailyStat.find({ user_id: userId, stat_date: { $gte: istSince(days) } }).lean())).map(mapDailyStat);

/** One finished day, only if it belongs to the user. */
export const findDailyStat = async (userId, sessionId) => {
  const doc = await DailyStat.findOne({ user_id: userId, session_id: sessionId }).lean();
  return doc ? mapDailyStat(doc) : null;
};

/** Closing capital of the most recent finished session (for "continue from yesterday"). */
export const findLastClosingCapital = async (userId) => {
  const [latest] = await byStartedAtDesc(await DailyStat.find({ user_id: userId }, 'session_id closing_capital').lean());
  return latest ? Number(latest.closing_capital) : null;
};
