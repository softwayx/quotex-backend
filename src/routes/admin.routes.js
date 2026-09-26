import { Router } from 'express';
import { authAdmin } from '../middlewares/authenticate.js';
import blogsRoutes from '../modules/admin/blogs/blogs.routes.js';
import auditRoutes from '../modules/admin/audit/audit.routes.js';
import authRoutes from '../modules/admin/auth/auth.routes.js';
import messagingRoutes from '../modules/admin/messaging/messaging.routes.js';
import overviewRoutes from '../modules/admin/overview/overview.routes.js';
import paymentsRoutes from '../modules/admin/payments/payments.routes.js';
import plansRoutes from '../modules/admin/plans/plans.routes.js';
import referralsRoutes from '../modules/admin/referrals/referrals.routes.js';
import settingsRoutes from '../modules/admin/settings/settings.routes.js';
import usersRoutes from '../modules/admin/users/users.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use(authAdmin);
router.use('/overview', overviewRoutes);
router.use('/users', usersRoutes);
router.use('/audit', auditRoutes);
router.use('/blogs', blogsRoutes);
router.use('/referral-settings', referralsRoutes);
router.use(plansRoutes);
router.use(settingsRoutes);
router.use(paymentsRoutes);
router.use(messagingRoutes);

export default router;
