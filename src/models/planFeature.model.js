import { ALIVE, defineModel } from './base.js';

export default defineModel(
  'PlanFeature',
  'plan_features',
  {
    tier: { type: String, enum: ['BASIC', 'PRO'], required: true },
    feature_key: { type: String, required: true },
    enabled: { type: Boolean, required: true },
    updated_by: { type: String, default: null },
  },
  [[{ tier: 1, feature_key: 1 }, { unique: true, partialFilterExpression: ALIVE }]],
);
