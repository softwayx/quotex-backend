import { ACTORS } from '../../../config/constants.js';
import { created, ok } from '../../../utils/apiResponse.js';
import { clearSessionCookie, setLanguageCookie, setSessionCookie } from '../../../utils/cookies.js';
import * as service from './auth.service.js';

const signIn = (res, { user, token }) => {
  setSessionCookie(res, ACTORS.USER, token);
  setLanguageCookie(res, user.language ?? 'en');
};

export const registerStart = async (req, res) => ok(res, await service.startRegistration(req.body));

export const registerVerify = async (req, res) => {
  const session = await service.verifyRegistration(req.body, req.get('user-agent'));
  signIn(res, session);
  created(res, { user: { username: session.user.username, displayName: session.user.display_name } });
};

export const login = async (req, res) => {
  const { result, token, language } = await service.loginUser(req.body, req.get('user-agent'));
  if (token) signIn(res, { user: { language }, token });
  ok(res, { user: result });
};

export const loginVerify = async (req, res) => {
  const session = await service.verifyLoginOtp(req.body, req.get('user-agent'));
  signIn(res, session);
  const { user } = session;
  ok(res, { user: { id: user.id, username: user.username, displayName: user.display_name } });
};

export const logout = async (req, res) => {
  await service.endSession(ACTORS.USER, req.cookies?.[ACTORS.USER.cookieName]);
  clearSessionCookie(res, ACTORS.USER);
  ok(res);
};
