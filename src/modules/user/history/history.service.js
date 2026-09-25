import { findDailyStat, listRecentDailyStats } from '../../../domain/trading/dailyStats.repository.js';
import { listTrades } from '../../../domain/trading/trades.repository.js';
import ApiError from '../../../utils/apiError.js';

export const listDays = (userId, days) => listRecentDailyStats(userId, days);

/** One finished day with its trades. Another user's session simply looks missing. */
export const getDay = async (userId, sessionId) => {
  const day = await findDailyStat(userId, sessionId);
  if (!day) throw ApiError.notFound('Session not found.');
  return { day, trades: await listTrades(sessionId) };
};
