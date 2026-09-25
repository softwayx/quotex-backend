import { ok } from '../../../utils/apiResponse.js';
import * as service from './invite.service.js';

/** For the sign-up page: `{ invite: { code, refereeDays } | null }`. */
export const invite = async (req, res) => ok(res, { invite: req.query.ref ? await service.getInviteInfo(req.query.ref) : null });
