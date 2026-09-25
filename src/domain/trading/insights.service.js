import { aggregatePeriod, buildBehaviour, buildInsights } from '../core/index.js';
import { FEATURES, INSIGHT_FEATURES } from '../shared/features.js';
import { getEntitlement } from '../entitlements/entitlements.js';
import { featureKeysFor, getFeatureMatrix } from '../features/features.js';
import { listInsightTrades, listSessionsWithTrades, listTradesSince } from './analytics.repository.js';

export const INSIGHT_RANGES = [7, 30, 90];
export const DEFAULT_INSIGHT_RANGE = 30;

/** Last-7-day analytics built from raw trades (so the live session is included). */
export const getWeeklyAnalytics = async (userId) => {
  const trades = await listTradesSince(userId);
  return { trades, ...aggregatePeriod(trades) };
};

/**
 * Insights for a user. Which sections they see depends on the features of their plan. When none of
 * the insight features is included the page is locked; `upgrade` lists what Pro would add.
 */
export const getInsightsView = async (userId, requestedDays) => {
  const days = INSIGHT_RANGES.includes(requestedDays) ? requestedDays : DEFAULT_INSIGHT_RANGE;
  const entitlement = await getEntitlement(userId);
  const [features, matrix] = await Promise.all([featureKeysFor(entitlement), getFeatureMatrix()]);

  // What the Pro plan has that this user does not: shown as the reason to upgrade.
  const upgrade = FEATURES.filter((f) => matrix.PRO[f.key] && !features.includes(f.key)).map((f) => f.label);
  const allowed = features.filter((key) => INSIGHT_FEATURES.includes(key));
  if (allowed.length === 0) return { locked: true, days, upgrade };
  // Discipline, gap and pattern analysis replay whole sessions, so they are only computed when the plan includes them.
  const wantsBehaviour = ['insight_discipline', 'insight_gap', 'insight_patterns'].some((key) => features.includes(key));
  const all = wantsBehaviour ? buildBehaviour(await listSessionsWithTrades(userId, days)) : null;
  const behaviour = all && {
    discipline: features.includes('insight_discipline') ? all.discipline : null,
    gaps: features.includes('insight_gap') ? all.gaps : null,
    patterns: features.includes('insight_patterns') ? all.patterns : null,
  };
  return { locked: false, days, features, upgrade, behaviour, insights: buildInsights(await listInsightTrades(userId, days)) };
};
