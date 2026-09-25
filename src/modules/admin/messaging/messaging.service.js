import { sendOtpEmail } from '../../../domain/messaging/email.service.js';
import { reconnectSession, sendTestMessage, toggleSession } from '../../../domain/messaging/whatsapp.service.js';
import { normalizePhone } from '../../../domain/shared/phone.js';
import ApiError from '../../../utils/apiError.js';

export { getMessagingSettingsView, updateMessagingSettings } from '../../../domain/messaging/messagingSettings.js';
export { addSession, getSessionLive, listSessionsView, removeSession } from '../../../domain/messaging/whatsapp.service.js';

export const sendTestEmail = (to) => sendOtpEmail(to, '123456', 'Admin');

/** reconnect | enable | disable | test (sends a test message to `phone`). */
export const runSessionAction = async (adminId, id, input) => {
  if (input.action === 'reconnect') return reconnectSession(id);
  if (input.action === 'test') {
    const phone = normalizePhone(input.phone);
    if (!phone) throw ApiError.validation('Enter a valid number with country code.');
    return sendTestMessage(id, phone);
  }
  return toggleSession(adminId, id, input.action === 'enable');
};
