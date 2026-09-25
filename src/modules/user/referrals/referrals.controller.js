import { ok } from '../../../utils/apiResponse.js';
import * as service from './referrals.service.js';

export const view = async (req, res) => ok(res, await service.getReferralView(req.user.id));
