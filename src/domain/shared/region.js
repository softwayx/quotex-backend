import { COUNTRIES } from './countries.js';

export const PLAN_TYPES = Object.freeze({ DOMESTIC: 'DOMESTIC', INTERNATIONAL: 'INTERNATIONAL' });

/** Home market. Customers here see domestic plans; everyone else sees international plans. */
export const HOME_COUNTRY = 'IN';

const CODES = new Set(COUNTRIES.map(([code]) => code));

export const isValidCountryCode = (code) => typeof code === 'string' && CODES.has(code.toUpperCase());

/** Which kind of plan a customer in `countryCode` may buy. `null` while the country is unknown. */
export const regionForCountry = (countryCode) => {
  if (!countryCode) return null;
  return countryCode.toUpperCase() === HOME_COUNTRY ? PLAN_TYPES.DOMESTIC : PLAN_TYPES.INTERNATIONAL;
};

export const countryName = (code) => COUNTRIES.find(([c]) => c === code?.toUpperCase())?.[1] ?? code ?? '—';

/** Customers in India pay in rupees, everyone else in dollars. Each plan carries one price for each. */
export const CURRENCY_BY_REGION = Object.freeze({ DOMESTIC: 'INR', INTERNATIONAL: 'USD' });
