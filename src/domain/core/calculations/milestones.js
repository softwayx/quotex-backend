import { TARGET_MILESTONES } from '../constants.js';

/**
 * The highest target milestone (50, 70) newly reached, or null.
 * `lastMilestone` is the highest one already celebrated, so each popup shows only once.
 * Reaching 100% is handled separately as "target reached".
 */
export const milestoneCrossed = (achievedPct, lastMilestone = 0) => {
  const crossed = TARGET_MILESTONES.filter((pct) => pct > lastMilestone && achievedPct >= pct && achievedPct < 100);
  return crossed.length ? Math.max(...crossed) : null;
};

export const isTargetReached = (achievedPct) => achievedPct >= 100;

/** The user may voluntarily stop (and lock for 24h) once the first milestone is reached. */
export const canStopAtMilestone = (achievedPct) => achievedPct >= TARGET_MILESTONES[0] && achievedPct < 100;
