import ApiError from '../utils/apiError.js';
import { fail } from '../utils/apiResponse.js';
import logger from '../utils/logger.js';

export const notFound = (req, _res, next) => next(ApiError.notFound(`Route not found: ${req.method} ${req.path}`));

export const errorHandler = (err, req, res, _next) => {
  if (err instanceof ApiError) {
    return fail(res, err.status, { code: err.code, message: err.message, ...(err.details !== undefined && { details: err.details }) });
  }
  if (err.type === 'entity.parse.failed') return fail(res, 400, { code: 'BAD_JSON', message: 'Invalid request body.' });
  if (err.type === 'entity.too.large') return fail(res, 413, { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large.' });
  if (err.code === 11000) return fail(res, 409, { code: 'CONFLICT', message: 'A record with these values already exists.' });
  (req.log ?? logger).error({ err }, 'unhandled error');
  return fail(res, 500, { code: 'INTERNAL', message: 'Something went wrong.' });
};
