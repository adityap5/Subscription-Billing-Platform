import Razorpay from 'razorpay';
import crypto from 'crypto';
import { getEnv } from '../config/env';
import { logger } from '../utils/logger';

let razorpayInstance: Razorpay | null = null;

function getRazorpay(): Razorpay {
  if (!razorpayInstance) {
    const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = getEnv();
    razorpayInstance = new Razorpay({
      key_id: RAZORPAY_KEY_ID,
      key_secret: RAZORPAY_KEY_SECRET,
    });
  }
  return razorpayInstance;
}

export async function createOrder(
  amountInPaise: number,
  receipt: string
): Promise<{ id: string; amount: number; currency: string }> {
  const rzp = getRazorpay();

  logger.info('Creating Razorpay order', { amountInPaise, receipt });

  const order = await rzp.orders.create({
    amount: amountInPaise,
    currency: 'INR',
    receipt,
  });

  logger.info('Razorpay order created', {
    orderId: order.id,
    amount: order.amount,
  });

  return {
    id: order.id,
    amount: order.amount as number,
    currency: order.currency,
  };
}

export function verifyWebhookSignature(
  rawBody: Buffer,
  signature: string
): boolean {
  const { RAZORPAY_WEBHOOK_SECRET } = getEnv();

  const expectedSignature = crypto
    .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'utf8'),
      Buffer.from(signature, 'utf8')
    );
  } catch {
    return false;
  }
}