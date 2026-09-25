import express, { Router } from 'express';
import adminRoutes from './admin.routes.js';
import publicRoutes from './public.routes.js';
import userRoutes from './user.routes.js';
import webhookRoutes from './webhook.routes.js';

const router = Router();

// Webhooks read the raw body for signature checks, so they are mounted before the JSON parser.
router.use('/webhook', webhookRoutes);
router.use(express.json({ limit: '100kb' }));
router.use('/public', publicRoutes);
router.use('/user', userRoutes);
router.use('/admin', adminRoutes);

export default router;
