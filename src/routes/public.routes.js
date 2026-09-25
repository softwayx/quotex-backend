import { Router } from 'express';
import healthRoutes from '../modules/public/health/health.routes.js';
import inviteRoutes from '../modules/public/invite/invite.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/invite', inviteRoutes);

export default router;
