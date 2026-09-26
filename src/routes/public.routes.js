import { Router } from 'express';
import blogsRoutes from '../modules/public/blogs/blogs.routes.js';
import healthRoutes from '../modules/public/health/health.routes.js';
import inviteRoutes from '../modules/public/invite/invite.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/invite', inviteRoutes);
router.use('/blogs', blogsRoutes);

export default router;
