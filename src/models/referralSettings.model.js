import { defineModel } from './base.js';

/** Single document. */
export default defineModel('ReferralSettings', 'referral_settings', {
  enabled: { type: Boolean, default: true },
  referrer_days: { type: Number, default: 7 },
  referee_days: { type: Number, default: 3 },
  reward_trigger: { type: String, enum: ['SIGNUP', 'FIRST_PAYMENT'], default: 'FIRST_PAYMENT' },
  max_rewards: { type: Number, default: 20 },
  updated_by: { type: String, default: null },
});
