import express, { Router } from 'express';
import * as controller from './razorpay.controller.js';

const router = Router();

router.post('/', express.raw({ type: '*/*', limit: '1mb' }), controller.razorpay);

export default router;
