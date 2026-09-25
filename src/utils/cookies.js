import env from '../config/env.js';
import { LANGUAGE_COOKIE } from '../config/constants.js';

const ONE_YEAR_MS = 365 * 86_400_000;

export const setSessionCookie = (res, actor, token) =>
  res.cookie(actor.cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProduction,
    path: '/',
    maxAge: actor.maxAgeSeconds * 1000,
  });

export const clearSessionCookie = (res, actor) => res.clearCookie(actor.cookieName, { path: '/' });

/** Mirrors the saved language preference so the website can render without asking the API. */
export const setLanguageCookie = (res, language) => res.cookie(LANGUAGE_COOKIE, language, { path: '/', sameSite: 'lax', maxAge: ONE_YEAR_MS });
