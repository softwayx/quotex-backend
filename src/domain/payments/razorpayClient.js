import { hmacSha256Hex, safeEqualHex } from '../../utils/crypto.js';

const API = 'https://api.razorpay.com/v1';
const TIMEOUT_MS = 15_000;

export class RazorpayError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'RazorpayError';
    this.status = status;
  }
}

const authHeader = ({ keyId, keySecret }) => `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;

const call = async (credentials, path, options = {}) => {
  let response;
  try {
    response = await fetch(`${API}${path}`, {
      ...options,
      headers: { Authorization: authHeader(credentials), 'Content-Type': 'application/json', ...options.headers },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new RazorpayError('Could not reach Razorpay. Please try again.', 502);
  }
  const body = await response.json().catch(() => ({}));
  // Razorpay's description is safe to show; it never contains our credentials.
  if (!response.ok) throw new RazorpayError(body?.error?.description ?? 'Razorpay rejected the request.', response.status);
  return body;
};

/** Creates an order. `amountMinor` is in the currency's smallest unit (paise, cents...). */
export const createOrder = (credentials, { amountMinor, currency, receipt, notes }) =>
  call(credentials, '/orders', { method: 'POST', body: JSON.stringify({ amount: amountMinor, currency, receipt, notes }) });

/** Cheap authenticated call used by the admin "Test connection" button. */
export const checkCredentials = (credentials) => call(credentials, '/orders?count=1');

/** Verifies the signature Checkout returns: HMAC_SHA256(orderId|paymentId, keySecret). */
export const verifyCheckoutSignature = ({ orderId, paymentId, signature }, keySecret) =>
  safeEqualHex(hmacSha256Hex(keySecret, `${orderId}|${paymentId}`), signature);

/** Verifies a webhook: HMAC_SHA256(rawBody, webhookSecret) equals X-Razorpay-Signature. */
export const verifyWebhookSignature = (rawBody, signature, webhookSecret) =>
  Boolean(signature) && safeEqualHex(hmacSha256Hex(webhookSecret, rawBody), signature);

/** Test keys start with rzp_test_, live keys with rzp_live_. */
export const modeOf = (keyId) => (keyId?.startsWith('rzp_live_') ? 'live' : keyId?.startsWith('rzp_test_') ? 'test' : null);
