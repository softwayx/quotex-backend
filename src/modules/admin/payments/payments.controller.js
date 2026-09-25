import { ok } from '../../../utils/apiResponse.js';
import * as service from './payments.service.js';

export const page = async (_req, res) => ok(res, await service.getPaymentsPage());

export const settings = async (_req, res) => ok(res, await service.getPaymentSettingsView());

export const updateSettings = async (req, res) => ok(res, await service.updatePaymentSettings(req.admin.id, req.body));

export const testConnection = async (_req, res) => ok(res, await service.testPaymentConnection());
