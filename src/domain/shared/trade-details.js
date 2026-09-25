/** Optional details a trader can record with each trade. Shared by the form, the API and the insights. */

/** Expiry timeframes offered in the form (stored as these codes). */
export const TIMEFRAMES = ['5s', '10s', '15s', '30s', '1m', '2m', '3m', '5m', '10m', '15m', '30m', '1h', '4h'];

/** Popular pairs and assets, offered as suggestions. Traders may type any other name. */
export const PAIR_SUGGESTIONS = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD', 'USD/CHF', 'NZD/USD', 'EUR/GBP', 'EUR/JPY', 'GBP/JPY',
  'AUD/JPY', 'EUR/AUD', 'EUR/CAD', 'EUR/CHF', 'GBP/AUD', 'GBP/CAD', 'GBP/CHF', 'AUD/CAD', 'AUD/CHF', 'CAD/JPY',
  'CHF/JPY', 'NZD/JPY', 'USD/INR', 'USD/BRL', 'USD/MXN', 'USD/TRY', 'USD/ZAR', 'BTC/USD', 'ETH/USD', 'LTC/USD',
  'XRP/USD', 'GOLD', 'SILVER', 'BRENT OIL', 'US CRUDE', 'APPLE', 'TESLA', 'AMAZON', 'GOOGLE', 'MICROSOFT',
];

const PAIR_ALLOWED = /[^A-Z0-9/ ._-]/g;

/** Trims, upper-cases and cleans a typed pair name. Returns null when nothing usable was typed. */
export const normalizePair = (value) => {
  if (typeof value !== 'string') return null;
  const cleaned = value.toUpperCase().replace(PAIR_ALLOWED, '').replace(/\s+/g, ' ').trim().slice(0, 24);
  return cleaned || null;
};

export const timeframeLabel = (code) => code ?? '';
