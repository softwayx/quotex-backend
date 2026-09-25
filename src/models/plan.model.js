import { ALIVE, defineModel } from './base.js';

export default defineModel(
  'Plan',
  'plans',
  {
    name: { type: String, required: true },
    duration_days: { type: Number, required: true, min: 1, max: 3650 },
    // Legacy single price; `prices` is the authoritative list the plan is sold in.
    price: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' },
    country_code: { type: String, default: 'IN' },
    is_active: { type: Boolean, default: true },
    is_trial: { type: Boolean, default: false },
    is_system: { type: Boolean, default: false },
    tier: { type: String, enum: ['BASIC', 'PRO', null], default: null },
    plan_type: { type: String, enum: ['DOMESTIC', 'INTERNATIONAL'], default: 'DOMESTIC' },
    prices: { type: [{ _id: false, currency: String, amount: Number }], default: [] },
  },
  [[{ tier: 1 }, { unique: true, partialFilterExpression: { ...ALIVE, tier: { $type: 'string' } } }]],
);
