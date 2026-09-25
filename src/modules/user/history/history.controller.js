import { ok } from '../../../utils/apiResponse.js';
import * as service from './history.service.js';

export const list = async (req, res) => ok(res, { days: await service.listDays(req.user.id, req.query.days) });

export const detail = async (req, res) => ok(res, await service.getDay(req.user.id, req.params.sessionId));
