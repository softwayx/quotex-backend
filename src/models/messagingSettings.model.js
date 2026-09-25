import { defineModel } from './base.js';

/** Single document. The Resend key is encrypted. Empty templates mean "use the built-in default". */
export default defineModel('MessagingSettings', 'messaging_settings', {
  resend_api_key_enc: { type: String, default: null },
  from_email: { type: String, default: null },
  whatsapp_template: { type: String, default: null },
  email_subject: { type: String, default: null },
  email_template: { type: String, default: null },
  updated_by: { type: String, default: null },
});
