import { defineModel } from './base.js';

/** Single document of platform switches. */
export default defineModel('AppSettings', 'app_settings', {
  lock_min_hours: { type: Number, default: 6, min: 1, max: 24 },
  community_feature_enabled: { type: Boolean, default: false },
  updated_by: { type: String, default: null },
});
