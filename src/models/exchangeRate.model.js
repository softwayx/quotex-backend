import { ALIVE, defineModel } from './base.js';

/** Last fetched rate for showing INR amounts in another currency. */
export default defineModel(
  'ExchangeRate',
  'exchange_rates',
  {
    currency: { type: String, required: true },
    rate: { type: Number, required: true },
    fetched_at: { type: Date, required: true },
  },
  [[{ currency: 1 }, { unique: true, partialFilterExpression: ALIVE }]],
);
