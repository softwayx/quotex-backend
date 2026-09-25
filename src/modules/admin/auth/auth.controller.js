import { ACTORS } from '../../../config/constants.js';
import { ok } from '../../../utils/apiResponse.js';
import { clearSessionCookie, setSessionCookie } from '../../../utils/cookies.js';
import * as service from './auth.service.js';

export const login = async (req, res) => {
  const { admin, token } = await service.loginAdmin(req.body, req.get('user-agent'));
  setSessionCookie(res, ACTORS.ADMIN, token);
  ok(res, { admin });
};

export const logout = async (req, res) => {
  await service.endSession(ACTORS.ADMIN, req.cookies?.[ACTORS.ADMIN.cookieName]);
  clearSessionCookie(res, ACTORS.ADMIN);
  ok(res);
};

export const me = (req, res) => ok(res, { admin: req.admin });
