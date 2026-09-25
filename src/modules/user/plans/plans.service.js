import { freeAnalysesView, getEntitlement } from '../../../domain/entitlements/entitlements.js';
import { getFeatureMatrix } from '../../../domain/features/features.js';
import { getStoredPaymentSettings, paymentsEnabled } from '../../../domain/payments/paymentSettings.js';
import { listUserPayments } from '../../../domain/payments/payments.service.js';
import { listPlans } from '../../../domain/plans/plans.repository.js';
import { getPlanSummary } from '../../../domain/subscriptions/subscriptions.js';

/** Everything the Plans page shows. Payment secrets never leave the server, only whether paying works. */
export const getPlansPage = async (userId) => {
  const [summary, plans, entitlement, settings, payments, matrix] = await Promise.all([
    getPlanSummary(userId),
    listPlans({ activeOnly: true, excludeTrial: true }),
    getEntitlement(userId),
    getStoredPaymentSettings(),
    listUserPayments(userId),
    getFeatureMatrix(),
  ]);
  return { summary, plans, entitlement, freeAnalyses: freeAnalysesView(entitlement), paymentsEnabled: paymentsEnabled(settings), payments, matrix };
};
