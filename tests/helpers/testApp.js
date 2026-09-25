import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { connectDatabase, disconnectDatabase } from '../../src/config/database.js';
import { ExchangeRate } from '../../src/models/index.js';
import { seedDefaults } from '../../src/seeders/defaults.js';

const app = createApp();

export const api = () => request(app);

/** Call in beforeAll: connects, builds every index, seeds the defaults. */
export const setupDb = async () => {
  await connectDatabase(process.env.MONGODB_URI);
  await mongoose.connection.syncIndexes();
  await seedDefaults();
};

/** Call in beforeEach: empties every collection (indexes stay) and re-seeds the defaults. */
export const resetDb = async () => {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
  await seedDefaults();
  // A fresh USD rate, so no test calls the live exchange-rate API. Minimum trade = ceil(1 / 0.012) = ₹84.
  await ExchangeRate.create({ currency: 'USD', rate: 0.012, fetched_at: new Date() });
};

export const closeDb = () => disconnectDatabase();
