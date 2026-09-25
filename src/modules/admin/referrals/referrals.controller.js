import { ok } from '../../../utils/apiResponse.js';
import * as service from './referrals.service.js';

export const view = async (_req, res) => ok(res, await service.getReferralAdminView());

export const update = async (req, res) => ok(res, await service.updateReferralSettings(req.admin.id, req.body));
