import { ALIVE, defineModel } from './base.js';

/**
 * Baileys key store (encrypted). The one collection that is hard-deleted: rotated signal keys are
 * secret material with no history value (see docs/DECISIONS.md).
 */
export default defineModel(
  'WhatsappAuth',
  'whatsapp_auth',
  {
    session_id: { type: String, required: true },
    key: { type: String, required: true },
    value_enc: { type: String, required: true },
  },
  [[{ session_id: 1, key: 1 }, { unique: true, partialFilterExpression: ALIVE }]],
);
