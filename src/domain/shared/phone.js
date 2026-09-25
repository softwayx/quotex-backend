import { COUNTRIES } from './countries.js';

/**
 * Normalises a phone number to digits only, country code included (for example "+91 98765 43210"
 * becomes "919876543210"). Returns null when it is not a plausible international number: the
 * country code must be a known one, and Indian numbers must be +91 followed by 10 digits.
 * A country code is never assumed, so the caller must supply it.
 */
export const normalizePhone = (input) => {
  const digits = String(input ?? '').replace(/[^\d]/g, '').replace(/^00/, '');
  if (digits.length < 8 || digits.length > 15) return null;
  const country = countryFromPhone(digits);
  if (!country) return null;
  if (country === 'IN' && !/^91[6-9]\d{9}$/.test(digits)) return null;
  return digits;
};

/** WhatsApp user id for a normalised number. */
export const toJid = (digits) => `${digits}@s.whatsapp.net`;

/** "9198••••3210" for showing where a code was sent without exposing the full number. */
export const maskPhone = (digits) => (digits.length > 6 ? `${digits.slice(0, 4)}••••${digits.slice(-4)}` : digits);

export const maskEmail = (email) => {
  const [name, domain] = String(email).split('@');
  return `${name.slice(0, 2)}••••@${domain}`;
};

// International dialling prefix -> ISO country. Shared prefixes (+1, +7) go to the biggest country.
const DIAL_CODES = {
  1: 'US', 7: 'RU', 20: 'EG', 27: 'ZA', 30: 'GR', 31: 'NL', 32: 'BE', 33: 'FR', 34: 'ES', 36: 'HU', 39: 'IT',
  40: 'RO', 41: 'CH', 43: 'AT', 44: 'GB', 45: 'DK', 46: 'SE', 47: 'NO', 48: 'PL', 49: 'DE', 51: 'PE', 52: 'MX',
  53: 'CU', 54: 'AR', 55: 'BR', 56: 'CL', 57: 'CO', 58: 'VE', 60: 'MY', 61: 'AU', 62: 'ID', 63: 'PH', 64: 'NZ',
  65: 'SG', 66: 'TH', 81: 'JP', 82: 'KR', 84: 'VN', 86: 'CN', 90: 'TR', 91: 'IN', 92: 'PK', 93: 'AF', 94: 'LK',
  95: 'MM', 98: 'IR', 212: 'MA', 213: 'DZ', 216: 'TN', 218: 'LY', 220: 'GM', 221: 'SN', 222: 'MR', 223: 'ML',
  224: 'GN', 225: 'CI', 226: 'BF', 227: 'NE', 228: 'TG', 229: 'BJ', 230: 'MU', 231: 'LR', 232: 'SL', 233: 'GH',
  234: 'NG', 235: 'TD', 236: 'CF', 237: 'CM', 238: 'CV', 239: 'ST', 240: 'GQ', 241: 'GA', 242: 'CG', 243: 'CD',
  244: 'AO', 245: 'GW', 248: 'SC', 249: 'SD', 250: 'RW', 251: 'ET', 252: 'SO', 253: 'DJ', 254: 'KE', 255: 'TZ',
  256: 'UG', 257: 'BI', 258: 'MZ', 260: 'ZM', 261: 'MG', 262: 'RE', 263: 'ZW', 264: 'NA', 265: 'MW', 266: 'LS',
  267: 'BW', 268: 'SZ', 269: 'KM', 350: 'GI', 351: 'PT', 352: 'LU', 353: 'IE', 354: 'IS', 355: 'AL', 356: 'MT',
  357: 'CY', 358: 'FI', 359: 'BG', 370: 'LT', 371: 'LV', 372: 'EE', 373: 'MD', 374: 'AM', 375: 'BY', 376: 'AD',
  377: 'MC', 378: 'SM', 380: 'UA', 381: 'RS', 382: 'ME', 385: 'HR', 386: 'SI', 387: 'BA', 389: 'MK', 420: 'CZ',
  421: 'SK', 423: 'LI', 500: 'FK', 501: 'BZ', 502: 'GT', 503: 'SV', 504: 'HN', 505: 'NI', 506: 'CR', 507: 'PA',
  591: 'BO', 592: 'GY', 593: 'EC', 594: 'GF', 595: 'PY', 597: 'SR', 598: 'UY', 673: 'BN', 670: 'TL', 674: 'NR',
  675: 'PG', 676: 'TO', 677: 'SB', 678: 'VU', 679: 'FJ', 680: 'PW', 685: 'WS', 686: 'KI', 852: 'HK', 853: 'MO',
  855: 'KH', 856: 'LA', 880: 'BD', 886: 'TW', 960: 'MV', 961: 'LB', 962: 'JO', 963: 'SY', 964: 'IQ', 965: 'KW',
  966: 'SA', 967: 'YE', 968: 'OM', 970: 'PS', 971: 'AE', 972: 'IL', 973: 'BH', 974: 'QA', 975: 'BT', 976: 'MN',
  977: 'NP', 992: 'TJ', 993: 'TM', 994: 'AZ', 995: 'GE', 996: 'KG', 998: 'UZ',
};

/**
 * Country (ISO code) from a normalised number, by its dialling prefix. Returns null for an
 * unknown prefix. Kazakhstan (+76/+77) is told apart from Russia; +1 always maps to the US.
 */
export const countryFromPhone = (digits) => {
  const d = String(digits ?? '');
  if (/^7[67]/.test(d)) return 'KZ';
  for (const length of [3, 2, 1]) {
    const country = DIAL_CODES[d.slice(0, length)];
    if (country) return country;
  }
  return null;
};

/** Country-code picker options for the sign-up form: [ISO, name, dialling prefix], India first. */
export const DIAL_OPTIONS = (() => {
  const names = new Map(COUNTRIES.map(([code, name]) => [code, name]));
  const rows = Object.entries(DIAL_CODES).map(([dial, iso]) => [iso, names.get(iso) ?? iso, dial]);
  rows.push(['CA', 'Canada', '1'], ['KZ', 'Kazakhstan', '7']);
  return rows.sort((a, b) => (a[0] === 'IN' ? -1 : b[0] === 'IN' ? 1 : a[1].localeCompare(b[1])));
})();
