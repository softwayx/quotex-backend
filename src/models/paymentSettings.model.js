import { defineModel } from './base.js';

/** Single document. Secrets are AES-256-GCM encrypted and never leave the server. */
export default defineModel('PaymentSettings', 'payment_settings', {
  razorpay_key_id: { type: String, default: null },
  razorpay_key_secret_enc: { type: String, default: null },
  razorpay_webhook_secret_enc: { type: String, default: null },
  enabled: { type: Boolean, default: false },
  site_url: { type: String, default: null },
  last_test_at: { type: Date, default: null },
  last_test_ok: { type: Boolean, default: null },
  last_test_message: { type: String, default: null },
  updated_by: { type: String, default: null },
});
