import { getDisplayRate } from '../../../domain/fx/exchangeRates.js';
import { getPlanSummary } from '../../../domain/subscriptions/subscriptions.js';

export { chooseCountry, detectLocation, getLocation } from '../../../domain/location/location.service.js';
export { updateUserPreferences } from '../../../domain/users/users.repository.js';

/** What every signed-in page needs: the user, their plan for the header and the display-currency rate. */
export const getAccount = async (user) => {
  const [plan, fx] = await Promise.all([getPlanSummary(user.id), getDisplayRate(user.currency)]);
  return { user, plan, fx };
};
