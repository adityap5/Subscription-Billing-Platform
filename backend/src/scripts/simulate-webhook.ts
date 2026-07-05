import crypto from 'crypto';
import { getEnv } from '../config/env';

async function simulateWebhook(orderId: string, paymentId: string = 'pay_test123') {
  const { RAZORPAY_WEBHOOK_SECRET, PORT } = getEnv();

  const payload = {
    entity: 'event',
    account_id: 'acc_test123',
    event: 'payment.captured',
    contains: ['payment'],
    payload: {
      payment: {
        entity: {
          id: paymentId,
          entity: 'payment',
          amount: 49900,
          currency: 'INR',
          status: 'captured',
          order_id: orderId,
          method: 'card',
          captured: true,
        },
      },
    },
    created_at: Math.floor(Date.now() / 1000),
  };

  const rawBody = JSON.stringify(payload);

  const signature = crypto
    .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  const url = `http://localhost:${PORT}/api/webhooks/razorpay`;

  console.log(`Sending simulated webhook to ${url}...`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': signature,
        'x-razorpay-event-id': `evnt_${Date.now()}`,
      },
      body: rawBody,
    });

    if (response.ok) {
      console.log('Webhook processed successfully! Status:', response.status);
    } else {
      console.error('Webhook failed. Status:', response.status);
      const text = await response.text();
      console.error('Response:', text);
    }
  } catch (err) {
    console.error('Failed to send webhook:', err);
  }
}

const orderId = process.argv[2];
if (!orderId) {
  console.error('Usage: bun run src/scripts/simulate-webhook.ts <orderId>');
  process.exit(1);
}

simulateWebhook(orderId);
