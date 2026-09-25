import { created, ok } from '../../../utils/apiResponse.js';
import * as service from './session.service.js';

export const dashboard = async (req, res) => ok(res, await service.getDashboard(req.user));

export const start = async (req, res) => created(res, await service.startSession(req.user, req.body));

export const trade = async (req, res) => created(res, await service.recordTrade(req.user, req.body));

export const payout = async (req, res) => ok(res, await service.changeMinPayout(req.user, req.body.minPayoutPct));

export const finish = async (req, res) => ok(res, await service.finishSession(req.user, { lock: Boolean(req.body.lock) }));
