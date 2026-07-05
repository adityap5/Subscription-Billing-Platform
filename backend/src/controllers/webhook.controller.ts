import { Request, Response, NextFunction } from 'express';
import * as razorpayService from '../services/razorpay.service';
import * as subscriptionService from '../services/subscription';
import { WebhookEvent } from '../models/webhookEvent.model';
import { webhookPayloadSchema } from '../validators/subscription.validator';
import { logger } from '../utils/logger';
import { ApiResponse } from '../types';

// POST /api/webhooks/razorpay
export async function handleWebhook(
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> {
  // TEMP — remove after capturing a sample payload for replay testing
  console.log('RAW BODY:', req.rawBody?.toString());
  console.log('SIGNATURE:', req.headers['x-razorpay-signature']);
  console.log('EVENT ID:', req.headers['x-razorpay-event-id']);

  // Step 1: Verify webhook signature (Edge #7)
  const signature = req.headers['x-razorpay-signature'] as string;
  if (!signature) {
    logger.warn('Webhook received without signature');
    res.status(400).json({
      success: false,
      message: 'Missing x-razorpay-signature header',
    } as ApiResponse);
    return;
  }

  if (!req.rawBody) {
    logger.error('Raw body not available for webhook verification');
    res.status(400).json({
      success: false,
      message: 'Raw body not available',
    } as ApiResponse);
    return;
  }

  const isValid = razorpayService.verifyWebhookSignature(
    req.rawBody,
    signature
  );

  if (!isValid) {
    logger.warn('Webhook signature verification failed', {
      signatureProvided: signature.substring(0, 10) + '...',
    });
    res.status(400).json({
      success: false,
      message: 'Invalid webhook signature',
    } as ApiResponse);
    return;
  }

  // Step 2: Validate payload shape (Edge #16)
  const parseResult = webhookPayloadSchema.safeParse(req.body);
  if (!parseResult.success) {
    logger.warn('Webhook payload validation failed', {
      errors: parseResult.error.issues,
    });
    res.status(400).json({
      success: false,
      message: 'Malformed webhook payload',
    } as ApiResponse);
    return;
  }

  const payload = parseResult.data;
  const eventId = req.headers['x-razorpay-event-id'] as string;

  if (!eventId) {
    logger.warn('Webhook received without event ID');
    res.status(400).json({
      success: false,
      message: 'Missing x-razorpay-event-id header',
    } as ApiResponse);
    return;
  }

  // Step 3: Idempotency check (Edge #3)
  try {
    await WebhookEvent.create({
      razorpayEventId: eventId,
      eventType: payload.event,
      payload: req.body,
      processedAt: new Date(),
    });
  } catch (error: unknown) {
    // Duplicate key error = event already processed
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: number }).code === 11000
    ) {
      logger.info('Duplicate webhook event, returning 200 (no-op)', {
        eventId,
        eventType: payload.event,
      });
      res.status(200).json({
        success: true,
        message: 'Event already processed',
      } as ApiResponse);
      return;
    }
    throw error;
  }

  // Step 5: Route to appropriate handler
  const paymentEntity = payload.payload.payment.entity;
  const razorpayOrderId = paymentEntity.order_id;
  const razorpayPaymentId = paymentEntity.id;

  logger.info('Processing webhook event', {
    eventId,
    eventType: payload.event,
    razorpayOrderId,
    razorpayPaymentId,
  });

  switch (payload.event) {
    case 'payment.captured':
      await subscriptionService.activateSubscription(
        razorpayOrderId,
        razorpayPaymentId
      );
      break;

    case 'payment.failed':
      await subscriptionService.failPayment(razorpayOrderId);
      break;

    default:
      // Ignore all other event types
      logger.info('Ignoring unhandled webhook event type', {
        eventType: payload.event,
      });
      break;
  }

  // Step 6: Always return 200 to Razorpay
  res.status(200).json({
    success: true,
    message: 'Webhook processed',
  } as ApiResponse);
}
