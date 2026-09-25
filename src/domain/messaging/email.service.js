import { OTP_TTL_MINUTES } from '../core/index.js';
import ApiError from '../../utils/apiError.js';
import logger from '../../utils/logger.js';
import { htmlToText, renderTemplate } from '../shared/message-templates.js';
import { getResendCredentials, getTemplates } from './messagingSettings.js';

/** Sends an email through Resend's REST API. Throws EMAIL_UNAVAILABLE when not configured or refused. */
export const sendEmail = async ({ to, subject, text, html }) => {
  const credentials = await getResendCredentials();
  if (!credentials) throw new ApiError('EMAIL_UNAVAILABLE', 'Email sending is not set up yet.', 503);

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${credentials.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: credentials.fromEmail, to, subject, text, ...(html ? { html } : {}) }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    logger.error({ status: response.status, body: body.slice(0, 200) }, 'Resend refused the message');
    throw new ApiError('EMAIL_UNAVAILABLE', 'Could not send the email. Please try again.', 503);
  }
};

/** Sends a code using the admin's email template (or the built-in default). */
export const sendOtpEmail = async (to, code, name = '') => {
  const templates = await getTemplates();
  const vars = { code, name: name || 'there', minutes: OTP_TTL_MINUTES };
  const html = renderTemplate(templates.email, vars, { html: true });
  return sendEmail({ to, subject: renderTemplate(templates.emailSubject, vars), html, text: htmlToText(html) });
};
