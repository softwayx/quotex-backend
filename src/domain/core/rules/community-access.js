/** Days a new user waits before the community board unlocks on its own. */
export const COMMUNITY_ACCESS_DAYS = 90;

const DAY_MS = 86_400_000;

/**
 * Community drawer access: an admin can grant it early (`earlyAccess`), otherwise it unlocks once
 * `COMMUNITY_ACCESS_DAYS` have passed since the user joined. `daysLeft` is 0 once unlocked.
 */
export const communityAccessFor = ({ createdAt, earlyAccess }, now = new Date()) => {
  if (earlyAccess) return { unlocked: true, daysLeft: 0 };
  const daysSinceJoin = Math.floor((now.getTime() - new Date(createdAt).getTime()) / DAY_MS);
  const daysLeft = Math.max(0, COMMUNITY_ACCESS_DAYS - daysSinceJoin);
  return { unlocked: daysLeft <= 0, daysLeft };
};

/**
 * Whether the community feature shows at all for this user: a global switch the admin can turn on
 * for everyone once it's ready, or per-user early access to preview it before that (the same flag
 * `communityAccessFor` uses to skip the 90-day wait once visible).
 */
export const communityVisibleFor = ({ globalEnabled, earlyAccess }) => Boolean(globalEnabled) || Boolean(earlyAccess);
