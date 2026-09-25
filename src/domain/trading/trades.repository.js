import { Trade } from '../../models/index.js';
import { mapTrade } from './mappers.js';

export const listTrades = async (sessionId, session) =>
  (await Trade.find({ session_id: sessionId }, null, { session }).sort({ seq: 1 }).lean()).map(mapTrade);

export const insertTrade = async ({ sessionId, userId, seq, result, amount, payoutPct, pnl, pair = null, isOtc = false, timeframe = null }, session) => {
  const [doc] = await Trade.create(
    [{ session_id: sessionId, user_id: userId, seq, result, amount, payout_pct: payoutPct, pnl, pair, is_otc: isOtc, timeframe }],
    { session },
  );
  return mapTrade(doc.toObject());
};
