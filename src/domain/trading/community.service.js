import { communityAccessFor, communityVisibleFor } from '../core/index.js';
import ApiError from '../../utils/apiError.js';
import { Trade } from '../../models/index.js';
import { getCommunityFeatureEnabled } from '../settings/appSettings.js';

export const COMMUNITY_WINDOWS = Object.freeze([5, 10, 15]);

/** A pair/timeframe needs at least this many recent trades before it appears on the board. */
const MIN_SAMPLE = 5;

/**
 * Top pairs/timeframes by win rate across every user's trades in the last `minutes` minutes.
 * Aggregated and anonymous — no user identity leaves this query.
 */
const topPairsByWindow = async (minutes) => {
  const rows = await Trade.aggregate([
    { $match: { created_at: { $gte: new Date(Date.now() - minutes * 60_000) }, pair: { $type: 'string' }, timeframe: { $type: 'string' } } },
    {
      $group: {
        _id: { pair: '$pair', timeframe: '$timeframe' },
        wins: { $sum: { $cond: [{ $eq: ['$result', 'WIN'] }, 1, 0] } },
        losses: { $sum: { $cond: [{ $eq: ['$result', 'LOSS'] }, 1, 0] } },
        total: { $sum: 1 },
      },
    },
    { $match: { total: { $gte: MIN_SAMPLE } } },
    { $addFields: { rate: { $divide: ['$wins', '$total'] } } },
    { $sort: { rate: -1, total: -1 } },
    { $limit: 10 },
  ]);
  return rows.map(({ _id, wins, losses, total }) => ({
    pair: _id.pair,
    timeframe: _id.timeframe,
    wins,
    losses,
    total,
    winRatePct: Math.round((wins / total) * 1000) / 10,
  }));
};

/** Whether this user sees the community feature, and — if visible — whether the board is unlocked yet. */
export const getCommunityStatus = async (user) => {
  const globalEnabled = await getCommunityFeatureEnabled();
  const visible = communityVisibleFor({ globalEnabled, earlyAccess: user.community_early_access });
  const access = communityAccessFor({ createdAt: user.created_at, earlyAccess: user.community_early_access });
  return { visible, unlocked: access.unlocked, daysLeft: access.daysLeft };
};

/** The ranked board for one time window. Re-checks access server-side — never trust the client alone. */
export const getCommunityBoard = async (user, minutes) => {
  if (!COMMUNITY_WINDOWS.includes(minutes)) throw ApiError.validation('Invalid time window.');
  const status = await getCommunityStatus(user);
  if (!status.visible || !status.unlocked) throw ApiError.forbidden('The community board is not available for this account yet.');
  return { minutes, rows: await topPairsByWindow(minutes) };
};
