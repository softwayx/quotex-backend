import jwt from 'jsonwebtoken';
import env from '../../config/env.js';
import { AuthSession } from '../../models/index.js';

const SECRETS = { USER: () => env.USER_SESSION_SECRET, ADMIN: () => env.ADMIN_SESSION_SECRET };

/** The cookie token only carries the server-side session id; the database row is the authority. */
const signToken = (actor, sessionId) =>
  jwt.sign({ sid: sessionId, typ: actor.type }, SECRETS[actor.type](), { algorithm: 'HS256', expiresIn: actor.maxAgeSeconds });

const verifyToken = (actor, token) => {
  try {
    const payload = jwt.verify(token, SECRETS[actor.type](), { algorithms: ['HS256'] });
    return payload.typ === actor.type && typeof payload.sid === 'string' ? payload.sid : null;
  } catch {
    return null;
  }
};

/** Creates a session row and returns the signed cookie token. */
export const startSession = async (actor, actorId, userAgent) => {
  const [session] = await AuthSession.create([
    {
      actor_type: actor.type,
      actor_id: actorId,
      expires_at: new Date(Date.now() + actor.maxAgeSeconds * 1000),
      user_agent: userAgent?.slice(0, 300) ?? null,
    },
  ]);
  return signToken(actor, session._id);
};

/** The actor id behind a cookie token, or null when the token or its session is not valid any more. */
export const readSessionActorId = async (actor, token) => {
  const sessionId = token && verifyToken(actor, token);
  if (!sessionId) return null;
  const session = await AuthSession.findOne({
    _id: sessionId,
    actor_type: actor.type,
    revoked_at: null,
    expires_at: { $gt: new Date() },
  }).lean();
  return session?.actor_id ?? null;
};

export const endSession = async (actor, token) => {
  const sessionId = token && verifyToken(actor, token);
  if (sessionId) await AuthSession.updateOne({ _id: sessionId, revoked_at: null }, { $set: { revoked_at: new Date() } });
};

/** Signs a user out everywhere (used when an account is disabled). */
export const revokeAllSessions = (actor, actorId, session) =>
  AuthSession.updateMany(
    { actor_type: actor.type, actor_id: actorId, revoked_at: null },
    { $set: { revoked_at: new Date() } },
    { session },
  );
