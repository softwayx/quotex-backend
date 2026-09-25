import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { errorHandler, notFound } from './middlewares/errorHandler.js';
import routes from './routes/index.js';
import logger from './utils/logger.js';

/**
 * The browser reaches this API through the Next.js app (`/api/v1/*` is proxied), so cookies are
 * first-party and no CORS is needed.
 */
export const createApp = () => {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cookieParser());
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/v1/public/health' } }));
app.get("/", (req, res) => {
  res.send("server is running on port 5500 riskquo");
});
  app.use('/api/v1', routes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
};
