import { WhatsappAuth } from '../../models/index.js';
import { decryptSecret, encryptSecret } from '../../utils/crypto.js';

const readValues = (sessionId, keys) => WhatsappAuth.find({ session_id: sessionId, key: { $in: keys } }, 'key value_enc').lean();

const writeValue = (sessionId, key, valueEnc) =>
  WhatsappAuth.updateOne({ session_id: sessionId, key }, { $set: { value_enc: valueEnc } }, { upsert: true });

const deleteValue = (sessionId, key) => WhatsappAuth.deleteOne({ session_id: sessionId, key });

/**
 * Baileys auth state stored in the database (encrypted) instead of files, so a connected WhatsApp session
 * survives restarts and redeploys. Same shape as Baileys' `useMultiFileAuthState`.
 */
export const useDbAuthState = async (sessionId, { BufferJSON, initAuthCreds, proto }) => {
  const encode = (value) => encryptSecret(JSON.stringify(value, BufferJSON.replacer));
  const decode = (stored) => JSON.parse(decryptSecret(stored), BufferJSON.reviver);

  const [credsRow] = await readValues(sessionId, ['creds']);
  const creds = credsRow ? decode(credsRow.value_enc) : initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const rows = await readValues(sessionId, ids.map((id) => `${type}-${id}`));
          const byKey = new Map(rows.map((row) => [row.key, row.value_enc]));
          const data = {};
          for (const id of ids) {
            const stored = byKey.get(`${type}-${id}`);
            if (!stored) continue;
            let value = decode(stored);
            if (type === 'app-state-sync-key' && value) value = proto.Message.AppStateSyncKeyData.fromObject(value);
            data[id] = value;
          }
          return data;
        },
        set: async (data) => {
          for (const [type, entries] of Object.entries(data)) {
            for (const [id, value] of Object.entries(entries)) {
              const key = `${type}-${id}`;
              if (value) await writeValue(sessionId, key, encode(value));
              else await deleteValue(sessionId, key);
            }
          }
        },
      },
    },
    saveCreds: () => writeValue(sessionId, 'creds', encode(creds)),
    clear: () => WhatsappAuth.deleteMany({ session_id: sessionId }),
  };
};
