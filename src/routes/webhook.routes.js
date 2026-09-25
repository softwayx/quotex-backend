import { Router } from 'express';
import razorpayRoutes from '../modules/webhook/razorpay/razorpay.routes.js';

const router = Router();

router.use('/razorpay', razorpayRoutes);

export default router;
