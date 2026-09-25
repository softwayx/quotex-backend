import { ALIVE, defineModel } from './base.js';

/** Free-analysis usage lives apart from trades so it cannot be reset by deleting data. */
export default defineModel(
  'TrialUsage',
  'trial_usage',
  {
    user_id: { type: String, required: true },
    analyses_used: { type: Number, default: 0, min: 0 },
  },
  [[{ user_id: 1 }, { unique: true, partialFilterExpression: ALIVE }]],
);
