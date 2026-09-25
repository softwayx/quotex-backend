import pino from 'pino';
import env from '../config/env.js';

export default pino({
  level: env.isTest ? 'silent' : env.LOG_LEVEL,
  redact: {
    paths: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]', '*.password', '*.keySecret', '*.webhookSecret'],
    censor: '[redacted]',
  },
  transport: env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
});
