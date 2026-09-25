import { OTP_TTL_MINUTES } from '../core/index.js';
import { withTransaction } from '../../config/database.js';
import { WhatsappSession, toRow } from '../../models/index.js';
import ApiError from '../../utils/apiError.js';
import logger from '../../utils/logger.js';
import { recordAudit } from '../audit/audit.service.js';
import { renderTemplate } from '../shared/message-templates.js';
import { toJid } from '../shared/phone.js';
import { getTemplates } from './messagingSettings.js';
import { getWhatsappQrImage, isWhatsappOpen, sendWhatsappText, startWhatsappSession, stopWhatsappSession } from './whatsappManager.js';

const toView = (row) => ({
  id: row.id,
  label: row.label,
  phone: row.phone,
  status: row.status,
  enabled: row.enabled,
  sentCount: row.sent_count,
  lastConnectedAt: row.last_connected_at,
  createdAt: row.created_at,
});

const listSessions = async () => (await WhatsappSession.find().sort({ created_at: 1 }).lean()).map((doc) => toView(toRow(doc)));

const findSession = async (id) => {
  const doc = await WhatsappSession.findById(id).lean();
  if (!doc) throw ApiError.notFound('Session not found.');
  return toView(toRow(doc));
};

const bumpSent = (id) => WhatsappSession.updateOne({ _id: id }, { $inc: { sent_count: 1 } });

const audit = (adminId, action, details) => withTransaction((session) => recordAudit({ adminId, action, details }, session));

const shuffle = (items) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

/**
 * Sends `text` to `phone` (digits with country code) from a randomly chosen connected, enabled
 * session; if that one fails, the next is tried. Throws WHATSAPP_UNAVAILABLE when none can send.
 */
export const sendWhatsappMessage = async (phone, text) => {
  const usable = shuffle((await listSessions()).filter((s) => s.enabled && isWhatsappOpen(s.id)));
  for (const session of usable) {
    try {
      await sendWhatsappText(session.id, toJid(phone), text);
      await bumpSent(session.id);
      return { sessionId: session.id };
    } catch (error) {
      logger.error({ id: session.id, err: error.message }, 'whatsapp send failed');
    }
  }
  throw new ApiError('WHATSAPP_UNAVAILABLE', 'WhatsApp verification is unavailable right now. Please try again later.', 503);
};

export const sendRegistrationOtp = async (phone, code, name = '') => {
  const { whatsapp } = await getTemplates();
  return sendWhatsappMessage(phone, renderTemplate(whatsapp, { code, name: name || 'there', minutes: OTP_TTL_MINUTES }));
};

/** Sessions with their live state, for the admin page. */
export const listSessionsView = async () => (await listSessions()).map((s) => ({ ...s, live: isWhatsappOpen(s.id) }));

/** Current status plus the QR image while the session is waiting to be scanned. */
export const getSessionLive = async (id) => ({ ...(await findSession(id)), live: isWhatsappOpen(id), qr: await getWhatsappQrImage(id) });

export const addSession = async (adminId, label) => {
  const [doc] = await WhatsappSession.create([{ label }]);
  await audit(adminId, 'WHATSAPP_SESSION_ADDED', { label });
  startWhatsappSession(doc._id).catch((error) => logger.error({ err: error.message }, 'whatsapp start failed'));
  return toView(toRow(doc.toObject()));
};

/** Starts (or restarts) a session, e.g. to get a fresh QR after it was logged out. */
export const reconnectSession = async (id) => {
  await findSession(id);
  await stopWhatsappSession(id);
  await startWhatsappSession(id);
};

export const toggleSession = async (adminId, id, enabled) => {
  await findSession(id);
  await WhatsappSession.updateOne({ _id: id }, { $set: { enabled } });
  if (!enabled) await stopWhatsappSession(id);
  else await startWhatsappSession(id);
  await audit(adminId, enabled ? 'WHATSAPP_SESSION_ENABLED' : 'WHATSAPP_SESSION_DISABLED', { id });
};

export const removeSession = async (adminId, id) => {
  const session = await findSession(id);
  await stopWhatsappSession(id, { logout: true });
  await WhatsappSession.softDelete({ _id: id });
  await audit(adminId, 'WHATSAPP_SESSION_REMOVED', { label: session.label });
};

/** Admin "send test message" from one specific session. */
export const sendTestMessage = async (id, phone) => {
  if (!isWhatsappOpen(id)) throw new ApiError('WHATSAPP_UNAVAILABLE', 'This session is not connected.', 409);
  await sendWhatsappText(id, toJid(phone), 'RiskQuo test message: this WhatsApp number is connected.');
  await bumpSent(id);
};
