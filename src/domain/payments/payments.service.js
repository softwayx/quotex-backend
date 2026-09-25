import { randomBytes } from 'node:crypto';
import { withTransaction } from '../../config/database.js';
import { Payment, Plan, User, UserSubscription, WebhookEvent, lockDoc } from '../../models/index.js';
import ApiError from '../../utils/apiError.js';
import logger from '../../utils/logger.js';
import { getEntitlement } from '../entitlements/entitlements.js';
import { getPlan, getPlanPrice } from '../plans/plans.repository.js';
import { rewardOnFirstPayment } from '../referrals/referrals.service.js';
import { CURRENCY_BY_REGION, regionForCountry } from '../shared/region.js';
import { planPeriod, setUserExpiry } from '../subscriptions/subscriptions.js';
import { getRazorpayCredentials } from './paymentSettings.js';
import { RazorpayError, createOrder, verifyCheckoutSignature, verifyWebhookSignature } from './razorpayClient.js';

/** All supported currencies have 2 decimals (INR, USD, GBP, EUR, AED). */
const toMinorUnits = (amount) => Math.round(amount * 100);

const requireCredentials = async () => {
  const credentials = await getRazorpayCredentials();
  if (!credentials?.enabled) throw new ApiError('PAYMENTS_DISABLED', 'Online payments are not available right now.', 503);
  return credentials;
};

/**
 * Step 1: the server decides the price (never the browser), creates a Razorpay order and
 * records it. The browser then opens Razorpay Checkout with the returned details.
 */
export const createCheckout = async (user, { planId, email, phone }) => {
  const credentials = await requireCredentials();

  const plan = await getPlan(planId);
  if (!plan || !plan.is_active || plan.is_trial || !plan.tier) throw ApiError.notFound('Plan not found.');

  // The user's detected country decides the currency (server-enforced).
  const region = regionForCountry(user.country_code);
  if (!region) throw new ApiError('LOCATION_REQUIRED', 'Set your location first so we can show the right plans.', 409);

  // Rupees for customers in India, dollars for everyone else.
  const currency = CURRENCY_BY_REGION[region];
  const amount = await getPlanPrice(planId, currency);
  if (amount === null) throw new ApiError('PRICE_UNAVAILABLE', `This plan is not sold in ${currency}.`, 422);
  if (amount <= 0) throw new ApiError('PRICE_UNAVAILABLE', 'This plan has no price set.', 422);
  const amountMinor = toMinorUnits(amount);

  let order;
  try {
    order = await createOrder(credentials, {
      amountMinor,
      currency,
      receipt: `rq_${randomBytes(9).toString('hex')}`,
      notes: { userId: user.id, planId, plan: plan.name },
    });
  } catch (error) {
    if (error instanceof RazorpayError) throw new ApiError('PAYMENT_PROVIDER_ERROR', error.message, 502);
    throw error;
  }

  await Payment.create([
    { user_id: user.id, plan_id: planId, razorpay_order_id: order.id, amount_minor: amountMinor, currency, billing_email: email, billing_phone: phone || null },
  ]);

  return {
    orderId: order.id,
    keyId: credentials.keyId,
    amountMinor,
    currency,
    planName: plan.name,
    prefill: { name: user.display_name, email, contact: phone || undefined },
  };
};

/**
 * Grants the plan for a paid order. Safe to call twice (Checkout callback and webhook):
 * the payment is locked and an already-paid order returns immediately.
 */
const fulfillPayment = async (session, payment, razorpayPaymentId) => {
  if (payment.status === 'PAID') return { alreadyPaid: true };

  const userId = payment.user_id;
  await lockDoc(User, { _id: userId }, session);
  const plan = await getPlan(payment.plan_id, session);
  const entitlement = await getEntitlement(userId, session);

  const { extend, startsAt, expiresAt } = planPeriod({
    currentExpiry: entitlement.subscriptionExpiresAt,
    onTrial: entitlement.onTrial,
    currentTier: entitlement.planTier,
    newTier: plan.tier,
    durationDays: plan.duration_days,
  });

  if (!extend) await UserSubscription.updateMany({ user_id: userId, revoked_at: null }, { $set: { revoked_at: new Date() } }, { session });
  const [subscription] = await UserSubscription.create(
    [{ user_id: userId, plan_id: payment.plan_id, starts_at: startsAt, expires_at: expiresAt, source: 'PAYMENT' }],
    { session },
  );
  await setUserExpiry(userId, expiresAt, session);
  await Payment.updateOne(
    { _id: payment.id },
    { $set: { status: 'PAID', razorpay_payment_id: razorpayPaymentId, subscription_id: subscription._id, paid_at: new Date(), failure_reason: null } },
    { session },
  );
  // The friend's first payment can reward the person who invited them.
  await rewardOnFirstPayment(session, userId);
  return { alreadyPaid: false, expiresAt };
};

/** Step 2: the browser reports success; Razorpay's signature is verified before anything is granted. */
export const verifyPayment = async (user, { orderId, paymentId, signature }) => {
  const credentials = await getRazorpayCredentials();
  if (!credentials) throw new ApiError('PAYMENTS_DISABLED', 'Online payments are not available right now.', 503);

  return withTransaction(async (session) => {
    const payment = await lockDoc(Payment, { razorpay_order_id: orderId }, session);
    if (!payment || payment.user_id !== user.id) throw ApiError.notFound('Payment not found.');
    if (!verifyCheckoutSignature({ orderId, paymentId, signature }, credentials.keySecret)) {
      throw new ApiError('INVALID_SIGNATURE', 'Payment could not be verified.', 400);
    }
    const result = await fulfillPayment(session, payment, paymentId);
    return { paid: true, expiresAt: result.expiresAt ?? null };
  });
};

/**
 * Razorpay webhook (the safety net if the browser closes after paying).
 * Returns { status, body } for the route to send. Errors that should be retried throw.
 */
export const handleWebhook = async ({ rawBody, signature, eventId }) => {
  const credentials = await getRazorpayCredentials();
  if (!credentials?.webhookSecret) return { status: 503, body: { ok: false, error: 'Payments are not configured.' } };
  if (!verifyWebhookSignature(rawBody, signature, credentials.webhookSecret)) return { status: 400, body: { ok: false, error: 'Invalid signature.' } };

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: { ok: false, error: 'Invalid payload.' } };
  }

  const event = payload.event;
  const paymentEntity = payload.payload?.payment?.entity;
  const uniqueId = eventId || `${event}:${paymentEntity?.id ?? payload.payload?.refund?.entity?.id ?? 'unknown'}`;

  await withTransaction(async (session) => {
    // A retried delivery of an event already handled is acknowledged and skipped.
    const registered = await WebhookEvent.updateOne(
      { event_id: uniqueId },
      { $setOnInsert: { event_id: uniqueId, event } },
      { upsert: true, session },
    );
    if (registered.upsertedCount !== 1) return;

    if ((event === 'payment.captured' || event === 'order.paid') && paymentEntity) {
      const payment = await lockDoc(Payment, { razorpay_order_id: paymentEntity.order_id }, session);
      if (!payment) return;
      // Never grant access if the paid amount or currency differs from what was created.
      if (Number(paymentEntity.amount) !== Number(payment.amount_minor) || paymentEntity.currency !== payment.currency) {
        logger.error({ orderId: paymentEntity.order_id }, 'webhook amount/currency mismatch');
        return;
      }
      await fulfillPayment(session, payment, paymentEntity.id);
    } else if (event === 'payment.failed' && paymentEntity) {
      await Payment.updateOne(
        { razorpay_order_id: paymentEntity.order_id, status: 'CREATED' },
        { $set: { status: 'FAILED', failure_reason: paymentEntity.error_description ?? 'Payment failed' } },
        { session },
      );
    } else if (event === 'refund.processed') {
      const refundedPaymentId = payload.payload?.refund?.entity?.payment_id;
      if (refundedPaymentId) {
        await Payment.updateOne({ razorpay_payment_id: refundedPaymentId, status: 'PAID' }, { $set: { status: 'REFUNDED' } }, { session });
      }
    }
  });

  return { status: 200, body: { ok: true } };
};

const planNames = async (ids) =>
  new Map((await Plan.find({ _id: { $in: ids } }, 'name duration_days', { withDeleted: true }).lean()).map((p) => [p._id, p]));

export const listUserPayments = async (userId, limit = 10) => {
  const payments = await Payment.find({ user_id: userId }).sort({ created_at: -1 }).limit(limit).lean();
  const plans = await planNames(payments.map((p) => p.plan_id));
  const subs = new Map(
    (await UserSubscription.find({ _id: { $in: payments.map((p) => p.subscription_id).filter(Boolean) } }, 'expires_at').lean()).map((s) => [s._id, s]),
  );
  return payments.map((p) => ({
    id: p._id,
    amount_minor: p.amount_minor,
    currency: p.currency,
    status: p.status,
    created_at: p.created_at,
    paid_at: p.paid_at,
    plan_name: plans.get(p.plan_id)?.name ?? null,
    duration_days: plans.get(p.plan_id)?.duration_days ?? null,
    valid_until: subs.get(p.subscription_id)?.expires_at ?? null,
  }));
};

export const listRecentPayments = async (limit = 50) => {
  const payments = await Payment.find().sort({ created_at: -1 }).limit(limit).lean();
  const plans = await planNames(payments.map((p) => p.plan_id));
  const users = new Map(
    (await User.find({ _id: { $in: payments.map((p) => p.user_id) } }, 'username', { withDeleted: true }).lean()).map((u) => [u._id, u.username]),
  );
  return payments.map((p) => ({
    id: p._id,
    amount_minor: p.amount_minor,
    currency: p.currency,
    status: p.status,
    created_at: p.created_at,
    paid_at: p.paid_at,
    razorpay_order_id: p.razorpay_order_id,
    razorpay_payment_id: p.razorpay_payment_id,
    failure_reason: p.failure_reason,
    plan_name: plans.get(p.plan_id)?.name ?? null,
    user_id: p.user_id,
    username: users.get(p.user_id) ?? null,
  }));
};
