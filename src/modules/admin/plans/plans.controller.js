import { ok } from '../../../utils/apiResponse.js';
import * as service from './plans.service.js';

export const list = async (req, res) => ok(res, { plans: await service.listPlans({ activeOnly: req.query.activeOnly }) });

export const update = async (req, res) => ok(res, await service.editPlan(req.admin.id, req.params.id, req.body));

export const features = async (_req, res) => ok(res, await service.getFeatureMatrix());

export const updateFeatures = async (req, res) => ok(res, await service.updatePlanFeatures(req.admin.id, req.body));
