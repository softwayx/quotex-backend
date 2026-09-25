import { HISTORY_DAYS } from '../core/index.js';
import { Trade, TradingSession } from '../../models/index.js';
import { istDate, istDayStart, istSince } from '../../utils/dates.js';
import { mapSession, mapTrade } from './mappers.js';

const sinceStart = (days) => istDayStart(istSince(days));

/** Trades of the last `days` IST days, oldest first. Includes the live session. */
export const listTradesSince = async (userId, days = HISTORY_DAYS) =>
  (await Trade.find({ user_id: userId, created_at: { $gte: sinceStart(days) } }).sort({ created_at: 1, seq: 1 }).lean()).map((row) => ({
    id: row._id,
    seq: row.seq,
    result: row.result,
    amount: Number(row.amount),
    payoutPct: Number(row.payout_pct),
    pnl: Number(row.pnl),
    at: row.created_at,
    day: istDate(row.created_at),
  }));

/** Trades of the last `days` IST days with the optional details, for the Pro insights. */
export const listInsightTrades = async (userId, days) =>
  (await Trade.find({ user_id: userId, created_at: { $gte: sinceStart(days) } }, 'result pnl pair timeframe is_otc created_at').sort({ created_at: 1 }).lean()).map(
    (row) => ({ result: row.result, pnl: Number(row.pnl), pair: row.pair, timeframe: row.timeframe, isOtc: row.is_otc, at: row.created_at }),
  );

/** Sessions started in the last `days` IST days, each with its trades (oldest first). Includes the live session. */
export const listSessionsWithTrades = async (userId, days) => {
  const sessions = (await TradingSession.find({ user_id: userId, started_at: { $gte: sinceStart(days) } }).sort({ started_at: 1 }).lean()).map(mapSession);
  if (sessions.length === 0) return [];

  const rows = await Trade.find({ session_id: { $in: sessions.map((s) => s.id) } }).sort({ session_id: 1, seq: 1 }).lean();
  const bySession = new Map(sessions.map((s) => [s.id, []]));
  for (const row of rows) bySession.get(row.session_id).push({ ...mapTrade(row), at: row.created_at });
  return sessions.map((session) => ({ ...session, trades: bySession.get(session.id) }));
};
