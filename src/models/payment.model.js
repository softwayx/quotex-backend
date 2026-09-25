import { ALIVE, defineModel } from './base.js';

export default defineModel(
  'Payment',
  'payments',
  {
    user_id: { type: String, required: true },
    plan_id: { type: String, required: true },
    provider: { type: String, default: 'RAZORPAY' },
    razorpay_order_id: { type: String, required: true },
    razorpay_payment_id: { type: String, default: null },
    amount_minor: { type: Number, required: true, min: 1 },
    currency: { type: String, required: true },
    status: { type: String, enum: ['CREATED', 'PAID', 'FAILED', 'REFUNDED'], default: 'CREATED' },
    billing_email: { type: String, default: null },
    billing_phone: { type: String, default: null },
    failure_reason: { type: String, default: null },
    subscription_id: { type: String, default: null },
    paid_at: { type: Date, default: null },
  },
  [
    [{ razorpay_order_id: 1 }, { unique: true, partialFilterExpression: ALIVE }],
    [{ razorpay_payment_id: 1 }, { unique: true, partialFilterExpression: { ...ALIVE, razorpay_payment_id: { $type: 'string' } } }],
    [{ user_id: 1, created_at: -1 }],
    [{ created_at: -1 }],
  ],
);
