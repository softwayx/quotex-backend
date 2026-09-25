export const CURRENCIES = {
  INR: { code: 'INR', symbol: '₹', locale: 'en-IN', name: 'Indian Rupee' },
  USD: { code: 'USD', symbol: '$', locale: 'en-US', name: 'US Dollar' },
  GBP: { code: 'GBP', symbol: '£', locale: 'en-GB', name: 'British Pound' },
  EUR: { code: 'EUR', symbol: '€', locale: 'de-DE', name: 'Euro' },
  AED: { code: 'AED', symbol: 'AED', locale: 'en-AE', name: 'UAE Dirham' },
};

export const DEFAULT_CURRENCY = 'INR';

/** All stored money (capital, trades, limits) is in this currency. Other currencies are display-only. */
export const BASE_CURRENCY = 'INR';

export const isSupportedCurrency = (code) => Object.hasOwn(CURRENCIES, code);
