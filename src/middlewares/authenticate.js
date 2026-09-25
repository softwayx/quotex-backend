import { ACTORS } from '../config/constants.js';
import { readSessionActorId } from '../domain/auth/sessions.js';
import { findAdminById } from '../domain/users/admins.repository.js';
import { findUserById } from '../domain/users/users.repository.js';
import ApiError from '../utils/apiError.js';

/** Signed-in, active user from the `rc_session` cookie -> `req.user`. Every user-side query is scoped by `req.user.id`. */
export const authUser = async (req, _res, next) => {
  try {
    const id = await readSessionActorId(ACTORS.USER, req.cookies?.[ACTORS.USER.cookieName]);
    const user = id && (await findUserById(id));
    if (!user || user.status !== 'ACTIVE') throw ApiError.unauthorized();
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

/** Signed-in admin from the `sa_session` cookie -> `req.admin`. */
export const authAdmin = async (req, _res, next) => {
  try {
    const id = await readSessionActorId(ACTORS.ADMIN, req.cookies?.[ACTORS.ADMIN.cookieName]);
    const admin = id && (await findAdminById(id));
    if (!admin) throw ApiError.unauthorized();
    req.admin = admin;
    next();
  } catch (error) {
    next(error);
  }
};
