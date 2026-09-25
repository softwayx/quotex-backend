import { ok } from '../../../utils/apiResponse.js';
import * as service from './audit.service.js';

export const list = async (req, res) => ok(res, await service.listAudit({ page: req.query.page }));
