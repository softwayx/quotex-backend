/** One envelope for every response: `{ ok: true, data }` or `{ ok: false, error: { code, message, details? } }`. */
export const ok = (res, data = {}, status = 200) => res.status(status).json({ ok: true, data });

export const created = (res, data) => ok(res, data, 201);

export const fail = (res, status, error) => res.status(status).json({ ok: false, error });
