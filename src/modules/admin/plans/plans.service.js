import { withTransaction } from '../../../config/database.js';
import { recordAudit } from '../../../domain/audit/audit.service.js';
import { getPlan, listPlans, updatePlan } from '../../../domain/plans/plans.repository.js';
import ApiError from '../../../utils/apiError.js';

export { getFeatureMatrix, updatePlanFeatures } from '../../../domain/features/features.js';
export { listPlans };

/**
 * Edits Basic or Pro: duration, rupee and dollar price, and whether it is on sale.
 * A plan on sale must have both prices (India pays in rupees, everyone else in dollars).
 */
export const editPlan = (adminId, planId, input) =>
  withTransaction(async (session) => {
    const existing = await getPlan(planId, session);
    if (!existing) throw ApiError.notFound('Plan not found.');
    if (!existing.tier) throw ApiError.validation('Only the Basic and Pro plans can be edited.');

    const current = Object.fromEntries(existing.prices.map((p) => [p.currency, Number(p.amount)]));
    const priceInr = input.priceInr ?? current.INR ?? 0;
    const priceUsd = input.priceUsd ?? current.USD ?? 0;
    const willBeActive = input.isActive ?? existing.is_active;
    if (willBeActive && !(priceInr > 0 && priceUsd > 0)) {
      throw ApiError.validation('Enter both prices (rupees for India and dollars for other countries) before putting a plan on sale.');
    }

    const prices =
      input.priceInr !== undefined || input.priceUsd !== undefined
        ? [
            { currency: 'INR', amount: priceInr },
            { currency: 'USD', amount: priceUsd },
          ]
        : undefined;
    const plan = await updatePlan(planId, { durationDays: input.durationDays, isActive: input.isActive, prices }, session);
    await recordAudit({ adminId, action: 'PLAN_UPDATED', details: { plan: plan.name, changes: input } }, session);
    return plan;
  });
