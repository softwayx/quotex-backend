import { ALIVE, defineModel } from './base.js';
import { RULE_FIELDS } from './recommendedSettings.model.js';

/** A user's own values. `null` means "follow the recommended value". */
const ownValues = Object.fromEntries(RULE_FIELDS.map((field) => [field, { type: Number, default: null }]));

export default defineModel(
  'RiskSettings',
  'risk_settings',
  {
    user_id: { type: String, required: true },
    ...ownValues,
    protected_locked_until: { type: Date, default: null },
  },
  [[{ user_id: 1 }, { unique: true, partialFilterExpression: ALIVE }]],
);
