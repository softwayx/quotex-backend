/** Placeholders an admin can use in the OTP templates. */
export const TEMPLATE_VARS = ['code', 'name', 'minutes'];

export const DEFAULT_WHATSAPP_TEMPLATE = 'Hi {{name}}, your RiskQuo verification code is *{{code}}*. It is valid for {{minutes}} minutes. Do not share it with anyone.';

export const DEFAULT_EMAIL_SUBJECT = 'Your RiskQuo code: {{code}}';

export const DEFAULT_EMAIL_TEMPLATE = `<div style="margin:0;padding:32px 16px;background:#f4f5f7;font-family:Segoe UI,Arial,sans-serif;">
  <div style="max-width:440px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06);">
    <div style="background:#111827;padding:22px 28px;">
      <span style="color:#f59e0b;font-size:20px;font-weight:700;letter-spacing:.3px;">RiskQuo</span>
    </div>
    <div style="padding:28px;">
      <p style="margin:0 0 6px;font-size:16px;color:#111827;">Hi {{name}},</p>
      <p style="margin:0 0 20px;font-size:14px;color:#4b5563;">Use this code to continue. It is valid for {{minutes}} minutes.</p>
      <div style="text-align:center;background:#fffbeb;border:1px dashed #f59e0b;border-radius:12px;padding:18px 0;">
        <span style="font-size:34px;font-weight:700;letter-spacing:10px;color:#111827;">{{code}}</span>
      </div>
      <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;">Never share this code with anyone. If you did not request it, you can ignore this email.</p>
    </div>
  </div>
</div>`;

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Replaces {{var}} with values. `html: true` escapes the values (the template itself is trusted admin HTML). */
export const renderTemplate = (template, vars, { html = false } = {}) =>
  String(template).replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) =>
    key in vars ? (html ? escapeHtml(vars[key]) : String(vars[key])) : match,
  );

export const htmlToText = (html) =>
  html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
