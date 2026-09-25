import QRCode from 'qrcode';
import { WhatsappSession } from '../../models/index.js';
import logger from '../../utils/logger.js';
import { useDbAuthState } from './whatsappAuthState.js';

const RECONNECT_MS = 3000;

/** One long-lived Baileys socket per connected WhatsApp number, kept in this API process. */
const state = {
  sockets: new Map(), // sessionId -> socket
  starting: new Set(), // sessionIds whose socket is being created (guards against a second socket)
  open: new Set(), // sessionIds currently connected
  qr: new Map(), // sessionId -> latest QR string
  wanted: new Set(), // sessions that should reconnect when they drop
};

let baileysPromise;
const loadBaileys = () => (baileysPromise ??= import('@whiskeysockets/baileys'));
const pickMakeSocket = (mod) => mod.default?.default ?? mod.default ?? mod.makeWASocket;

export const setWhatsappStatus = (id, status, phone) => {
  const set = { status };
  if (phone) set.phone = phone;
  if (status === 'CONNECTED') set.last_connected_at = new Date();
  return WhatsappSession.updateOne({ _id: id }, { $set: set });
};

const createSocket = async (sessionId) => {
  const baileys = await loadBaileys();
  const makeWASocket = pickMakeSocket(baileys);
  const { Browsers, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = baileys;
  const auth = await useDbAuthState(sessionId, baileys);
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }));
  const log = logger.child({ whatsappSession: sessionId }, { level: 'warn' });

  const socket = makeWASocket({
    version,
    logger: log,
    auth: { creds: auth.state.creds, keys: makeCacheableSignalKeyStore(auth.state.keys, log) },
    // A browser WhatsApp knows; a custom name leaves the phone stuck on "logging in" after the scan.
    browser: Browsers.macOS('Chrome'),
    syncFullHistory: false,
    markOnlineOnConnect: false,
  });
  return { socket, auth, DisconnectReason };
};

export const startWhatsappSession = async (sessionId) => {
  if (state.sockets.has(sessionId) || state.starting.has(sessionId)) return;
  state.wanted.add(sessionId);
  state.starting.add(sessionId);
  let created;
  try {
    created = await createSocket(sessionId);
  } finally {
    state.starting.delete(sessionId);
  }
  const { socket, auth, DisconnectReason } = created;
  state.sockets.set(sessionId, socket);
  // Only this socket's own events may change the session's state (a newer socket may have replaced it).
  const current = () => state.sockets.get(sessionId) === socket;

  // Saves run one after another; a reconnect waits for them so it starts with the login just made.
  let saving = Promise.resolve();
  socket.ev.on('creds.update', () => {
    saving = saving
      .then(auth.saveCreds)
      .catch((error) => logger.error({ err: error.message, whatsappSession: sessionId }, 'whatsapp creds not saved'));
  });

  socket.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (!current()) return;
    if (qr) {
      state.qr.set(sessionId, qr);
      await setWhatsappStatus(sessionId, 'PENDING_QR');
    }
    if (connection === 'open') {
      state.qr.delete(sessionId);
      state.open.add(sessionId);
      const phone = socket.user?.id?.split(':')[0]?.split('@')[0] ?? null;
      logger.info({ whatsappSession: sessionId, phone }, 'whatsapp connected');
      await setWhatsappStatus(sessionId, 'CONNECTED', phone);
    }
    if (connection === 'close') {
      state.open.delete(sessionId);
      state.sockets.delete(sessionId);
      const code = lastDisconnect?.error?.output?.statusCode;
      // 515 "restart required" right after a scan is normal: the socket reconnects with the saved login.
      logger.info({ whatsappSession: sessionId, code, reason: lastDisconnect?.error?.message }, 'whatsapp connection closed');
      if (code === DisconnectReason.loggedOut) {
        state.wanted.delete(sessionId);
        state.qr.delete(sessionId);
        await auth.clear();
        await setWhatsappStatus(sessionId, 'LOGGED_OUT');
      } else {
        await setWhatsappStatus(sessionId, 'DISCONNECTED');
        await saving;
        if (state.wanted.has(sessionId)) {
          setTimeout(
            () => startWhatsappSession(sessionId).catch((error) => logger.error({ err: error.message, whatsappSession: sessionId }, 'whatsapp reconnect failed')),
            RECONNECT_MS,
          );
        }
      }
    }
  });
};

/** Disconnects a session. `logout` also unlinks the device from the phone. */
export const stopWhatsappSession = async (sessionId, { logout = false } = {}) => {
  state.wanted.delete(sessionId);
  const socket = state.sockets.get(sessionId);
  state.sockets.delete(sessionId);
  state.open.delete(sessionId);
  state.qr.delete(sessionId);
  if (!socket) return;
  try {
    if (logout) await socket.logout();
    else socket.end(undefined);
  } catch {
    // Already closed.
  }
};

export const isWhatsappOpen = (sessionId) => state.open.has(sessionId);

/** The QR for a session that is waiting to be scanned, as a PNG data URL (or null). */
export const getWhatsappQrImage = async (sessionId) => {
  const qr = state.qr.get(sessionId);
  return qr ? QRCode.toDataURL(qr, { margin: 1, width: 280 }) : null;
};

export const sendWhatsappText = async (sessionId, jid, text) => {
  const socket = state.sockets.get(sessionId);
  if (!socket || !state.open.has(sessionId)) throw new Error('Session is not connected.');
  await socket.sendMessage(jid, { text });
};

/** Reconnects every enabled session after the API starts. */
export const startAllWhatsappSessions = async () => {
  const sessions = await WhatsappSession.find({ enabled: true, status: { $ne: 'LOGGED_OUT' } }, '_id').lean();
  for (const { _id } of sessions) {
    await startWhatsappSession(_id).catch((error) => logger.error({ err: error.message, id: _id }, 'whatsapp session could not start'));
  }
};

export const stopAllWhatsappSessions = () => Promise.all([...state.sockets.keys()].map((id) => stopWhatsappSession(id)));
