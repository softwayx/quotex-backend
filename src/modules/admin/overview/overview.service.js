import { getOverviewCounts, listExpiringSoon, listRecentSignups } from '../users/users.reports.js';

export const getOverview = async () => {
  const [counts, expiring, recent] = await Promise.all([getOverviewCounts(), listExpiringSoon(), listRecentSignups()]);
  return { counts, expiring, recent };
};
