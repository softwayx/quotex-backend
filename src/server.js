import env from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { startAllWhatsappSessions, stopAllWhatsappSessions } from './domain/messaging/whatsappManager.js';
import { createApp } from './app.js';
import { seedDefaults } from './seeders/defaults.js';
import logger from './utils/logger.js';

const start = async () => {
  await connectDatabase();
  await seedDefaults();
  const server = createApp().listen(env.PORT, () => logger.info(`API listening on :${env.PORT}`));

  if (env.WHATSAPP_ENABLED) {
    startAllWhatsappSessions().catch((error) => logger.error({ err: error.message }, 'whatsapp boot failed'));
  }

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'shutting down');
    setTimeout(() => process.exit(1), 10_000).unref();
    server.close(async () => {
      await Promise.allSettled([stopAllWhatsappSessions(), disconnectDatabase()]);
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};

process.on('unhandledRejection', (err) => logger.error({ err }, 'unhandled rejection'));

start().catch((err) => {
  logger.fatal({ err }, 'failed to start');
  process.exit(1);
});
