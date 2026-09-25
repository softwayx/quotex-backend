const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Calendar date in India (YYYY-MM-DD) for a moment in time. */
export const istDate = (date = new Date()) => new Date(new Date(date).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);

/** The first moment of an IST calendar date, as a Date. */
export const istDayStart = (ymd) => new Date(`${ymd}T00:00:00+05:30`);

/** IST date `days - 1` days before today, so a window of `days` includes today. */
export const istSince = (days, now = new Date()) => istDate(new Date(now.getTime() - (days - 1) * 86_400_000));

export const iso = (value) => (value ? new Date(value).toISOString() : null);
