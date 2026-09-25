import { withTransaction } from '../../config/database.js';
import { User, lockDoc } from '../../models/index.js';
import ApiError from '../../utils/apiError.js';
import { iso } from '../../utils/dates.js';
import { recordAudit } from '../audit/audit.service.js';
import { isValidCountryCode, regionForCountry } from '../shared/region.js';

const REDETECT_MIN_SECONDS = 30;
const GEOCODE_URL = 'https://api.bigdatacloud.net/data/reverse-geocode-client';

const view = (row) => ({
  countryCode: row.country_code ?? null,
  source: row.country_source ?? null,
  region: regionForCountry(row.country_code),
  detectedAt: iso(row.country_detected_at),
});

const lockUserRow = async (userId, session) => {
  const row = await lockDoc(User, { _id: userId }, session, { projection: 'country_code country_source country_detected_at' });
  if (!row) throw ApiError.notFound('User not found.');
  return row;
};

const writeCountry = async (userId, code, source, session) => {
  const row = await User.findOneAndUpdate(
    { _id: userId },
    { $set: { country_code: code, country_source: source, country_detected_at: new Date() } },
    { returnDocument: 'after', session, lean: true, projection: 'country_code country_source country_detected_at' },
  );
  return view(row);
};

/**
 * Coordinates -> ISO country via BigDataCloud's free endpoint (no key). The coordinates are used for
 * this one lookup and never stored. Null when the lookup fails.
 */
const countryFromCoordinates = async (latitude, longitude) => {
  try {
    const url = `${GEOCODE_URL}?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}&localityLanguage=en`;
    const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!response.ok) return null;
    const code = (await response.json())?.countryCode;
    return typeof code === 'string' && /^[A-Za-z]{2}$/.test(code) ? code.toUpperCase() : null;
  } catch {
    return null;
  }
};

export const getLocation = async (userId) => view(await User.findById(userId, 'country_code country_source country_detected_at').lean());

/** The user allowed browser location. Only the country is kept. */
export const detectLocation = async (user, { latitude, longitude }) => {
  const country = await countryFromCoordinates(latitude, longitude);
  if (!country || !isValidCountryCode(country)) {
    throw new ApiError('LOCATION_LOOKUP_FAILED', 'We could not work out your country. Please choose it manually.', 502);
  }
  return withTransaction(async (session) => {
    const row = await lockUserRow(user.id, session);
    // A country taken from the mobile number or set by an admin is only changed by an admin.
    if (row.country_source === 'PHONE' || row.country_source === 'ADMIN') return view(row);
    // Ignore rapid repeat calls (double clicks, silent refresh racing a click).
    const recent = row.country_detected_at && Date.now() - new Date(row.country_detected_at).getTime() < REDETECT_MIN_SECONDS * 1000;
    if (recent && row.country_source === 'GPS' && row.country_code === country) return view(row);
    return writeCountry(user.id, country, 'GPS', session);
  });
};

/** Manual choice, for people who deny location. A country from GPS, phone or an admin cannot be replaced by hand. */
export const chooseCountry = async (user, code) => {
  const country = String(code ?? '').toUpperCase();
  if (!isValidCountryCode(country)) throw ApiError.validation('Choose a valid country.');

  return withTransaction(async (session) => {
    const row = await lockUserRow(user.id, session);
    if (['GPS', 'ADMIN', 'PHONE'].includes(row.country_source)) {
      const message = {
        ADMIN: 'Your country was set by our team. Contact support to change it.',
        PHONE: 'Your country is set from your mobile number. Contact support to change it.',
        GPS: 'Your country was detected from your location. Allow location again to update it.',
      }[row.country_source];
      throw new ApiError('COUNTRY_LOCKED', message, 409);
    }
    return writeCountry(user.id, country, 'MANUAL', session);
  });
};

/** Super admin override (for example a traveller or a wrongly detected user). */
export const adminSetCountry = (adminId, userId, code) => {
  const country = String(code ?? '').toUpperCase();
  if (!isValidCountryCode(country)) throw ApiError.validation('Choose a valid country.');

  return withTransaction(async (session) => {
    const before = await lockUserRow(userId, session);
    const result = await writeCountry(userId, country, 'ADMIN', session);
    await recordAudit(
      { adminId, userId, action: 'COUNTRY_CHANGED', details: { from: before.country_code, to: country, previousSource: before.country_source } },
      session,
    );
    return result;
  });
};
