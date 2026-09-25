const DAY = 60 * 60 * 24;

/** User and admin auth are fully isolated: separate cookie, secret and lifetime. */
export const ACTORS = Object.freeze({
  USER: { type: 'USER', cookieName: 'rc_session', maxAgeSeconds: 7 * DAY },
  ADMIN: { type: 'ADMIN', cookieName: 'sa_session', maxAgeSeconds: DAY / 2 },
});

export const LANGUAGE_COOKIE = 'lang';
export const LANGUAGES = Object.freeze(['en']);

export const ADMIN_ROLES = Object.freeze({ SUPER_ADMIN: 'SUPER_ADMIN' });

export const LOGIN_LOCK = Object.freeze({ MAX_FAILED_ATTEMPTS: 5, LOCK_MINUTES: 15 });

export const DAY_MS = 86_400_000;
