import { ok } from '../../../utils/apiResponse.js';
import * as service from './users.service.js';

export const list = async (req, res) => ok(res, await service.listUsers(req.query));

export const detail = async (req, res) => ok(res, await service.getUserPage(req.params.id));

export const remove = async (req, res) => ok(res, await service.deleteUser(req.admin.id, req.params.id));

export const assignPlan = async (req, res) => ok(res, await service.assignPlan(req.admin.id, req.params.id, req.body));

export const adjustExpiry = async (req, res) => ok(res, await service.adjustExpiry(req.admin.id, req.params.id, req.body));

export const revokePlan = async (req, res) => {
  await service.revokePlan(req.admin.id, req.params.id);
  ok(res);
};

export const setStatus = async (req, res) => ok(res, await service.setUserStatus(req.admin.id, req.params.id, req.body.status));

export const unlock = async (req, res) => ok(res, await service.unlockUserTrading(req.admin.id, req.params.id, req.body.reason));

export const communityAccess = async (req, res) => ok(res, await service.setCommunityEarlyAccess(req.admin.id, req.params.id, req.body.granted));

export const country = async (req, res) => ok(res, await service.adminSetCountry(req.admin.id, req.params.id, req.body.countryCode));
