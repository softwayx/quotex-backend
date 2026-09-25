import { ok } from '../../../utils/apiResponse.js';
import * as service from './overview.service.js';

export const overview = async (_req, res) => ok(res, await service.getOverview());
