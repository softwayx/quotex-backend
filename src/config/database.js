import mongoose from 'mongoose';
import env from './env.js';

mongoose.set('strictQuery', true);

export const connectDatabase = (uri = env.MONGODB_URI) => mongoose.connect(uri, { autoIndex: true });

export const disconnectDatabase = () => mongoose.disconnect();

/**
 * Runs `work(session)` in a transaction. Mongoose retries it on transient conflicts, so `work`
 * must only touch the database (no network calls, no messages).
 */
export const withTransaction = (work) => mongoose.connection.transaction((session) => work(session));
