import { withTransaction } from '../../config/database.js';
import { MessagingSettings, SINGLETON_ID } from '../../models/index.js';
import { decryptSecret, encryptSecret } from '../../utils/crypto.js';
import { recordAudit } from '../audit/audit.service.js';
import { DEFAULT_EMAIL_SUBJECT, DEFAULT_EMAIL_TEMPLATE, DEFAULT_WHATSAPP_TEMPLATE } from '../shared/message-templates.js';

const read = () => MessagingSettings.findById(SINGLETON_ID).lean();

/** The templates in use: the admin's own, or the built-in defaults. */
export const getTemplates = async () => {
  const r = await read();
  return {
    whatsapp: r.whatsapp_template || DEFAULT_WHATSAPP_TEMPLATE,
    emailSubject: r.email_subject || DEFAULT_EMAIL_SUBJECT,
    email: r.email_template || DEFAULT_EMAIL_TEMPLATE,
  };
};

/** What the admin UI may see: whether a key is saved, never the key itself. */
export const getMessagingSettingsView = async () => {
  const r = await read();
  return {
    hasResendKey: Boolean(r.resend_api_key_enc),
    fromEmail: r.from_email,
    updatedAt: r.updated_at,
    templates: await getTemplates(),
    defaults: { whatsapp: DEFAULT_WHATSAPP_TEMPLATE, emailSubject: DEFAULT_EMAIL_SUBJECT, email: DEFAULT_EMAIL_TEMPLATE },
  };
};

/** Decrypted credentials for sending email. Null when not fully configured. */
export const getResendCredentials = async () => {
  const r = await read();
  if (!r.resend_api_key_enc || !r.from_email) return null;
  return { apiKey: decryptSecret(r.resend_api_key_enc), fromEmail: r.from_email };
};

/**
 * A new key is only stored when a non-empty value is given. Templates: undefined leaves as is,
 * an empty string resets to the built-in default.
 */
export const updateMessagingSettings = async (adminId, input) => {
  const set = { updated_by: adminId };
  if (input.resendApiKey) set.resend_api_key_enc = encryptSecret(input.resendApiKey);
  if (input.fromEmail) set.from_email = input.fromEmail;
  const templates = { whatsappTemplate: 'whatsapp_template', emailSubject: 'email_subject', emailTemplate: 'email_template' };
  for (const [key, field] of Object.entries(templates)) {
    if (input[key] !== undefined) set[field] = input[key].trim() || null;
  }
  await withTransaction(async (session) => {
    await MessagingSettings.updateOne({ _id: SINGLETON_ID }, { $set: set }, { session });
    await recordAudit(
      { adminId, action: 'MESSAGING_SETTINGS_UPDATED', details: { keyChanged: Boolean(input.resendApiKey), fromEmail: input.fromEmail || null } },
      session,
    );
  });
  return getMessagingSettingsView();
};
