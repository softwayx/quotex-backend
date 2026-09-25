import { ok } from '../../../utils/apiResponse.js';
import * as service from './plans.service.js';

export const page = async (req, res) => ok(res, await service.getPlansPage(req.user.id));
