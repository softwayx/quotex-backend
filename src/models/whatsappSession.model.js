import { defineModel } from './base.js';

export default defineModel('WhatsappSession', 'whatsapp_sessions', {
  label: { type: String, required: true },
  phone: { type: String, default: null },
  status: { type: String, enum: ['PENDING_QR', 'CONNECTED', 'DISCONNECTED', 'LOGGED_OUT'], default: 'PENDING_QR' },
  enabled: { type: Boolean, default: true },
  sent_count: { type: Number, default: 0 },
  last_connected_at: { type: Date, default: null },
});
