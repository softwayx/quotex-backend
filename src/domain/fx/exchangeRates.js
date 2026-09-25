import { BASE_CURRENCY, CURRENCIES } from '../shared/currencies.js';
import { ExchangeRate } from '../../models/index.js';
import logger from '../../utils/logger.js';

const RATES_URL = 'https://open.er-api.com/v6/latest/INR';
const MAX_AGE_MS = 6 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 6000;

// Rough values, only used when no live rate has ever been fetched (e.g. first start with no internet).
const FALLBACK = { USD: 0.012, GBP: 0.0094, EUR: 0.011, AED: 0.044 };

const readStored = async () =>
  Object.fromEntries((await ExchangeRate.find().lean()).map((row) => [row.currency, { rate: Number(row.rate), fetchedAt: row.fetched_at }]));

const fetchLive = async () => {
  const response = await fetch(RATES_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`Rate API returned ${response.status}`);
  const body = await response.json();
  if (body.result !== 'success' || !body.rates) throw new Error('Rate API returned no rates');
  return body.rates;
};

const saveRates = async (rates) => {
  const now = new Date();
  for (const code of Object.keys(CURRENCIES)) {
    const rate = Number(rates[code]);
    if (code === BASE_CURRENCY || !(rate > 0)) continue;
    await ExchangeRate.updateOne({ currency: code }, { $set: { rate, fetched_at: now } }, { upsert: true });
  }
};

let inFlight = null;

/** Refreshes from the live API when the stored rates are older than 6 hours. Never throws. */
const refreshIfStale = async (stored) => {
  const newest = Math.max(0, ...Object.values(stored).map((entry) => new Date(entry.fetchedAt).getTime()));
  if (Date.now() - newest < MAX_AGE_MS) return stored;
  inFlight ??= fetchLive()
    .then(saveRates)
    .catch((error) => logger.warn({ err: error.message }, 'exchange-rate refresh failed'))
    .finally(() => {
      inFlight = null;
    });
  await inFlight;
  return readStored();
};

/** Rate for showing INR amounts in `currency`: { rate, updatedAt, approximate }. INR is always 1. */
export const getDisplayRate = async (currency) => {
  if (currency === BASE_CURRENCY) return { rate: 1, updatedAt: null, approximate: false };
  const stored = await refreshIfStale(await readStored());
  const entry = stored[currency];
  if (entry) return { rate: entry.rate, updatedAt: new Date(entry.fetchedAt).toISOString(), approximate: false };
  return { rate: FALLBACK[currency] ?? 1, updatedAt: null, approximate: true };
};
