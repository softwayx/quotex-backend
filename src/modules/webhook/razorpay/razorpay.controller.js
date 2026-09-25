import logger from '../../../utils/logger.js';
import * as service from './razorpay.service.js';

/**
 * Public on purpose: protected by the signature check, which needs the exact raw body, so the body
 * arrives as a Buffer and is never re-serialised. A 500 makes Razorpay retry the delivery later.
 */
export const razorpay = async (req, res) => {
  try {
    const { status, body } = await service.handleWebhook({
      rawBody: Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '',
      signature: req.get('x-razorpay-signature'),
      eventId: req.get('x-razorpay-event-id'),
    });
    res.status(status).json(body);
  } catch (error) {
    logger.error({ err: error }, 'webhook processing failed');
    res.status(500).json({ ok: false });
  }
};
