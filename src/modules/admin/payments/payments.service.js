import { getPaymentChecklist, getPaymentSettingsView } from '../../../domain/payments/paymentSettings.js';
import { listRecentPayments } from '../../../domain/payments/payments.service.js';

export { getPaymentSettingsView, testPaymentConnection, updatePaymentSettings } from '../../../domain/payments/paymentSettings.js';

/** The admin Payments page: settings, checklist and recent payments. */
export const getPaymentsPage = async () => {
  const [settings, payments, checklist] = await Promise.all([getPaymentSettingsView(), listRecentPayments(), getPaymentChecklist()]);
  return { settings, payments, checklist };
};
