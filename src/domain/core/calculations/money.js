export const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

export const roundUpToStep = (value, step) => Math.ceil(value / step - 1e-9) * step;

export const roundDownToStep = (value, step) => Math.floor(value / step + 1e-9) * step;

export const roundToStep = (value, step) => Math.round(value / step) * step;

export const percentOf = (part, whole) => (whole > 0 ? round2((part / whole) * 100) : 0);
