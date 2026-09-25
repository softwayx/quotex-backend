import env from '../../config/env.js';
import { withTransaction } from '../../config/database.js';
import { PaymentSettings, SINGLETON_ID } from '../../models/index.js';
import ApiError from '../../utils/apiError.js';
import { decryptSecret, encryptSecret } from '../../utils/crypto.js';
import { iso } from '../../utils/dates.js';
import { recordAudit } from '../audit/audit.service.js';
import { listPlans } from '../plans/plans.repository.js';
import { RazorpayError, checkCredentials, modeOf } from './razorpayClient.js';

export const WEBHOOK_PATH = '/api/v1/webhook/razorpay';
const LOCAL_HOST = /^(localhost|127\.|0\.0\.0\.0|\[::1\]|.*\.local$)/i;
const SITE_URL = /^https?:\/\/[^\s/]+[^\s]*$/i;

const trimSlash = (url) => url.replace(/\/+$/, '');

/** Stored settings with secrets still encrypted. Decrypted values are only produced for Razorpay calls. */
export const getStoredPaymentSettings = async (session) => {
  const row = await PaymentSettings.findById(SINGLETON_ID, null, { session }).lean();
  return {
    keyId: row.razorpay_key_id,
    keySecretEnc: row.razorpay_key_secret_enc,
    webhookSecretEnc: row.razorpay_webhook_secret_enc,
    enabled: row.enabled,
    siteUrl: row.site_url,
    lastTestAt: row.last_test_at,
    lastTestOk: row.last_test_ok,
    lastTestMessage: row.last_test_message,
    updatedAt: row.updated_at,
  };
};

/** Decrypted credentials for calling Razorpay. Null when not fully configured. */
export const getRazorpayCredentials = async () => {
  const stored = await getStoredPaymentSettings();
  // The webhook secret is optional: paying works with just the key pair (the browser confirms the payment).
  if (!stored.keyId || !stored.keySecretEnc) return null;
  return {
    keyId: stored.keyId,
    keySecret: decryptSecret(stored.keySecretEnc),
    webhookSecret: stored.webhookSecretEnc ? decryptSecret(stored.webhookSecretEnc) : null,
    enabled: stored.enabled,
  };
};

/** True when a customer can actually pay. */
export const paymentsEnabled = (stored) => Boolean(stored.enabled && stored.keyId && stored.keySecretEnc);

/** The public address Razorpay must be able to reach: the admin's value, else the env default. */
const effectiveSiteUrl = (stored) => trimSlash(stored.siteUrl || env.SITE_URL);

const isPublicHttps = (url) => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && !LOCAL_HOST.test(parsed.hostname);
  } catch {
    return false;
  }
};

/** What the admin screen may see. Secrets are never returned, only whether they are saved. */
export const getPaymentSettingsView = async () => {
  const stored = await getStoredPaymentSettings();
  const siteUrl = effectiveSiteUrl(stored);
  return {
    keyId: stored.keyId ?? '',
    hasKeySecret: Boolean(stored.keySecretEnc),
    hasWebhookSecret: Boolean(stored.webhookSecretEnc),
    enabled: stored.enabled,
    mode: modeOf(stored.keyId),
    siteUrl: stored.siteUrl ?? '',
    effectiveSiteUrl: siteUrl,
    webhookUrl: `${siteUrl}${WEBHOOK_PATH}`,
    lastTest: stored.lastTestAt ? { at: iso(stored.lastTestAt), ok: stored.lastTestOk, message: stored.lastTestMessage } : null,
    updatedAt: iso(stored.updatedAt),
  };
};

/**
 * A live checklist of everything the admin still has to do before real payments work.
 * status: ok | todo | warn | manual. `required` items block "ready".
 */
export const getPaymentChecklist = async () => {
  const stored = await getStoredPaymentSettings();
  const activePlans = await listPlans({ activeOnly: true });
  const plans = activePlans.filter((plan) => !plan.is_trial);
  const mode = modeOf(stored.keyId);
  const siteUrl = effectiveSiteUrl(stored);
  const sellsIn = (currency) => plans.some((plan) => plan.tier && plan.prices.some((price) => price.currency === currency && Number(price.amount) > 0));

  const items = [
    {
      id: 'keys',
      required: true,
      title: 'Razorpay API keys saved',
      status: stored.keyId && stored.keySecretEnc ? 'ok' : 'todo',
      help: 'Razorpay Dashboard → Account & Settings → API Keys → Generate Key. Paste the Key ID and Key Secret below.',
    },
    {
      id: 'webhook-secret',
      required: false,
      title: 'Webhook secret saved (recommended)',
      status: stored.webhookSecretEnc ? 'ok' : 'warn',
      help: 'Payments work without it. It is a safety net: if a customer pays but closes the page early, the webhook still activates their plan. Razorpay Dashboard → Webhooks → Add, choose your own secret string and paste the same string below.',
    },
    {
      id: 'connection',
      required: true,
      title: 'Connection test passed',
      status: stored.lastTestOk === true ? 'ok' : 'todo',
      help:
        stored.lastTestOk === false
          ? `Last test failed: ${stored.lastTestMessage ?? 'unknown error'}. Check the keys and try again.`
          : 'Click "Test connection" after saving the keys.',
    },
    {
      id: 'public-url',
      required: false,
      title: 'Public website address is https',
      status: isPublicHttps(siteUrl) ? 'ok' : 'todo',
      help: `Razorpay cannot reach ${siteUrl}. Enter your live https website address in "Public website URL", then add the webhook URL in Razorpay. While developing, use a tunnel such as ngrok.`,
    },
    {
      id: 'events',
      required: false,
      title: 'Webhook events selected in Razorpay',
      status: 'manual',
      help: 'In Razorpay → Webhooks, tick payment.captured, order.paid, payment.failed and refund.processed. This cannot be checked automatically.',
    },
    {
      id: 'domestic-plan',
      required: true,
      title: 'A domestic plan is on sale (India, INR)',
      status: sellsIn('INR') ? 'ok' : 'todo',
      help: 'Plans → Basic or Pro → enter the India price (₹) above 0 and switch the plan on.',
    },
    {
      id: 'international-plan',
      required: false,
      title: 'An international plan is on sale (outside India)',
      status: sellsIn('USD') ? 'ok' : 'warn',
      help: 'Without one, customers outside India see no plans. Plans → Basic or Pro → enter the international price ($) above 0.',
    },
    {
      id: 'international-enabled',
      required: false,
      title: 'International Payments enabled on your Razorpay account',
      status: 'manual',
      help: 'Razorpay Dashboard → Account & Settings → International Payments, or ask Razorpay support. Needed to accept cards from outside India.',
    },
    {
      id: 'trial',
      required: false,
      title: 'Free 7-day trial for every new user',
      status: activePlans.some((plan) => plan.is_trial) ? 'ok' : 'warn',
      help: 'The free trial is built in and needs nothing from you. If this is not green, restart the API so it seeds the default plans.',
    },
    {
      id: 'mode',
      required: false,
      title: mode === 'live' ? 'Live keys in use' : 'Test keys in use',
      status: mode === 'live' ? 'ok' : mode === 'test' ? 'warn' : 'todo',
      help: mode === 'live' ? 'Real money will be charged.' : 'Test mode charges no real money. When testing is done, replace the keys with rzp_live_ keys.',
    },
    {
      id: 'enabled',
      required: true,
      title: 'Payments switched on',
      status: stored.enabled ? 'ok' : 'todo',
      help: 'Tick "Accept payments" and save once the items above are done.',
    },
  ];

  const required = items.filter((item) => item.required);
  const done = required.filter((item) => item.status === 'ok').length;
  return { items, requiredDone: done, requiredTotal: required.length, ready: done === required.length };
};

/**
 * Saves settings. A secret is only replaced when a new non-empty value is provided.
 * Changing a credential resets the stored connection-test result, because it no longer applies.
 */
export const updatePaymentSettings = async (adminId, input) => {
  if (input.siteUrl && !SITE_URL.test(input.siteUrl)) {
    throw new ApiError('INVALID_URL', 'Enter the website address like https://www.yourdomain.com', 422);
  }
  await withTransaction(async (session) => {
    const before = await getStoredPaymentSettings(session);
    const set = { updated_by: adminId };
    if (input.keyId) set.razorpay_key_id = input.keyId;
    if (input.keySecret) set.razorpay_key_secret_enc = encryptSecret(input.keySecret);
    if (input.webhookSecret) set.razorpay_webhook_secret_enc = encryptSecret(input.webhookSecret);
    if (input.enabled !== undefined) set.enabled = input.enabled;
    if (input.siteUrl !== undefined) set.site_url = trimSlash(input.siteUrl) || null;
    if (input.keyId || input.keySecret || input.webhookSecret) Object.assign(set, { last_test_at: null, last_test_ok: null, last_test_message: null });
    await PaymentSettings.updateOne({ _id: SINGLETON_ID }, { $set: set }, { session });
    const after = await getStoredPaymentSettings(session);

    if (after.enabled && !(after.keyId && after.keySecretEnc)) {
      throw new ApiError('PAYMENTS_INCOMPLETE', 'Save the key ID and key secret before enabling payments.', 422);
    }
    if (after.keyId && modeOf(after.keyId) === null) throw new ApiError('INVALID_KEY_ID', 'Key ID must start with rzp_test_ or rzp_live_.', 422);

    // The audit trail records what changed, never the secret values.
    await recordAudit(
      {
        adminId,
        action: 'PAYMENT_SETTINGS_UPDATED',
        details: {
          keyIdChanged: before.keyId !== after.keyId,
          keySecretReplaced: Boolean(input.keySecret),
          webhookSecretReplaced: Boolean(input.webhookSecret),
          siteUrlChanged: (before.siteUrl ?? '') !== (after.siteUrl ?? ''),
          enabled: after.enabled,
          mode: modeOf(after.keyId),
        },
      },
      session,
    );
  });
  return getPaymentSettingsView();
};

const saveConnectionTestResult = ({ ok, message }) =>
  PaymentSettings.updateOne({ _id: SINGLETON_ID }, { $set: { last_test_at: new Date(), last_test_ok: ok, last_test_message: message ?? null } });

/** Calls Razorpay with the saved credentials to confirm they are valid, and remembers the result. */
export const testPaymentConnection = async () => {
  const credentials = await getRazorpayCredentials();
  if (!credentials) throw new ApiError('PAYMENTS_INCOMPLETE', 'Save the key ID and key secret first.', 422);
  try {
    await checkCredentials(credentials);
  } catch (error) {
    if (error instanceof RazorpayError) {
      await saveConnectionTestResult({ ok: false, message: error.message });
      throw new ApiError('PAYMENT_TEST_FAILED', error.message, 422);
    }
    throw error;
  }
  await saveConnectionTestResult({ ok: true, message: null });
  return { ok: true, mode: modeOf(credentials.keyId) };
};
