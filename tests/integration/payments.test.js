import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { Payment, Plan, User, UserSubscription, WebhookEvent } from '../../src/models/index.js';
import { hmacSha256Hex } from '../../src/utils/crypto.js';
import { KEY_SECRET, WEBHOOK_SECRET, configurePayments, createUser, userCookie } from '../helpers/factories.js';
import { api, closeDb, resetDb, setupDb } from '../helpers/testApp.js';

beforeAll(setupDb);
beforeEach(resetDb);
afterAll(closeDb);

const createdPayment = async (user, overrides = {}) => {
  const pro = await Plan.findOne({ tier: 'PRO' }).lean();
  const [payment] = await Payment.create([
    { user_id: user.id, plan_id: pro._id, razorpay_order_id: `order_${Date.now()}`, amount_minor: 25000, currency: 'INR', ...overrides },
  ]);
  return payment;
};

const webhook = (event, secret = WEBHOOK_SECRET, eventId = 'evt_1') => {
  const raw = JSON.stringify(event);
  return api()
    .post('/api/v1/webhook/razorpay')
    .set('Content-Type', 'application/json')
    .set('x-razorpay-signature', hmacSha256Hex(secret, raw))
    .set('x-razorpay-event-id', eventId)
    .send(raw);
};

const captured = (payment, amount = payment.amount_minor) => ({
  event: 'payment.captured',
  payload: { payment: { entity: { id: 'pay_123456', order_id: payment.razorpay_order_id, amount, currency: 'INR' } } },
});

describe('payments', () => {
  it('a signed webhook grants the plan once; a replay is skipped', async () => {
    await configurePayments();
    const user = await createUser();
    const payment = await createdPayment(user);

    expect((await webhook(captured(payment))).status).toBe(200);
    expect((await webhook(captured(payment))).status).toBe(200);

    const paid = await Payment.findById(payment._id).lean();
    expect(paid.status).toBe('PAID');
    expect(await UserSubscription.countDocuments({ user_id: user.id, source: 'PAYMENT' })).toBe(1);
    expect(await WebhookEvent.countDocuments()).toBe(1);
    // A running trial is replaced from now and its unused 7 days are added on top of the 30 paid days.
    const days = ((await User.findById(user.id).lean()).subscription_expires_at - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(36.9);
  });

  it('rejects a bad signature and ignores an amount mismatch', async () => {
    await configurePayments();
    const payment = await createdPayment(await createUser());
    expect((await webhook(captured(payment), 'wrong-secret')).status).toBe(400);
    await webhook(captured(payment, 1), WEBHOOK_SECRET, 'evt_2').expect(200);
    expect((await Payment.findById(payment._id).lean()).status).toBe('CREATED');
  });

  it('the browser verify step checks the checkout signature and the owner', async () => {
    await configurePayments();
    const user = await createUser();
    const other = await createUser();
    const payment = await createdPayment(user);
    const body = {
      razorpay_order_id: payment.razorpay_order_id,
      razorpay_payment_id: 'pay_abcdef',
      razorpay_signature: hmacSha256Hex(KEY_SECRET, `${payment.razorpay_order_id}|pay_abcdef`),
    };

    const stranger = await api().post('/api/v1/user/payments/verify').set('Cookie', await userCookie(other)).send(body);
    expect(stranger.status).toBe(404);

    const res = await api().post('/api/v1/user/payments/verify').set('Cookie', await userCookie(user)).send(body);
    expect(res.status).toBe(200);
    expect(res.body.data.paid).toBe(true);

    const plans = await api().get('/api/v1/user/plans').set('Cookie', await userCookie(user));
    expect(plans.body.data.summary.planName).toBe('Pro');
    expect(plans.body.data.paymentsEnabled).toBe(true);
    expect(JSON.stringify(plans.body)).not.toContain('secret');
  });
});
