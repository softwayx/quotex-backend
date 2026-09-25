import { ok } from '../../../utils/apiResponse.js';
import * as service from './health.service.js';

export const health = async (_req, res) => {
  const data = await service.check();
  ok(res, data, data.status === 'ok' ? 200 : 503);
};
