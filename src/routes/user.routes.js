import { Router } from 'express';
import { authUser } from '../middlewares/authenticate.js';
import accountRoutes from '../modules/user/account/account.routes.js';
import analyticsRoutes from '../modules/user/analytics/analytics.routes.js';
import authRoutes from '../modules/user/auth/auth.routes.js';
import communityRoutes from '../modules/user/community/community.routes.js';
import historyRoutes from '../modules/user/history/history.routes.js';
import paymentsRoutes from '../modules/user/payments/payments.routes.js';
import plansRoutes from '../modules/user/plans/plans.routes.js';
import referralsRoutes from '../modules/user/referrals/referrals.routes.js';
import sessionRoutes from '../modules/user/session/session.routes.js';
import settingsRoutes from '../modules/user/settings/settings.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use(authUser);
router.use('/account', accountRoutes);
router.use('/session', sessionRoutes);
router.use('/settings', settingsRoutes);
router.use('/history', historyRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/plans', plansRoutes);
router.use('/payments', paymentsRoutes);
router.use('/referrals', referralsRoutes);
router.use('/community', communityRoutes);

export default router;
