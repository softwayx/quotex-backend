import { created, ok } from '../../../utils/apiResponse.js';
import * as service from './payments.service.js';

export const createOrder = async (req, res) => created(res, await service.createCheckout(req.user, req.body));

export const verify = async (req, res) =>
  ok(
    res,
    await service.verifyPayment(req.user, {
      orderId: req.body.razorpay_order_id,
      paymentId: req.body.razorpay_payment_id,
      signature: req.body.razorpay_signature,
    }),
  );
