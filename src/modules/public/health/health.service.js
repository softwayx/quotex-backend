import mongoose from 'mongoose';

export const check = async () => {
  const database = mongoose.connection.readyState === 1 ? await mongoose.connection.db.admin().ping().then(() => 'up', () => 'down') : 'down';
  return { status: database === 'up' ? 'ok' : 'degraded', database, uptimeSeconds: Math.round(process.uptime()) };
};
