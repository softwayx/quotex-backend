import { ok } from '../../../utils/apiResponse.js';
import * as service from './community.service.js';

export const status = async (req, res) => ok(res, await service.getCommunityStatus(req.user));

export const board = async (req, res) => ok(res, await service.getCommunityBoard(req.user, req.query.minutes));
