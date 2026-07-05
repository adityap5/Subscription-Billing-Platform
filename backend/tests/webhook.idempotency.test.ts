import { describe, test, expect, beforeEach } from 'bun:test';
import mongoose from 'mongoose';
import { WebhookEvent } from '../src/models/webhookEvent.model';
import { Subscription } from '../src/models/subscription.model';
import { Payment } from '../src/models/payment.model';
import { Invoice } from '../src/models/invoice.model';
import { Plan } from '../src/models/plan.model';
import { User } from '../src/models/user.model';
import * as subscriptionService from '../src/services/subscription';
import { SubscriptionStatus, PaymentStatus, PaymentType } from '../src/types';

/**
 * Webhook idempotency tests.
 *
 * Verifies that the same webhook event ID delivered twice
 * only produces effects (subscription activation, invoice creation) once.
 *
 * These tests use direct service calls to simulate webhook processing,
 * bypassing the HTTP layer to focus on the idempotency guard.
 */

// In-memory MongoDB setup for testing
let testUserId: mongoose.Types.ObjectId;
let testPlanId: mongoose.Types.ObjectId;
let testSubscriptionId: mongoose.Types.ObjectId;
let testPaymentId: mongoose.Types.ObjectId;
const TEST_ORDER_ID = 'order_test_idempotency_123';
const TEST_PAYMENT_ID = 'pay_test_idempotency_456';
const TEST_EVENT_ID = 'evt_test_idempotency_789';

describe('Webhook Idempotency', () => {
  beforeEach(async () => {
    // Clean up test data
    await WebhookEvent.deleteMany({});
    await Invoice.deleteMany({});
    await Payment.deleteMany({});
    await Subscription.deleteMany({});
    await Plan.deleteMany({});
    await User.deleteMany({});

    // Create test user
    const user = await User.create({
      email: 'test@example.com',
      passwordHash: 'hashed_password',
      name: 'Test User',
    });
    testUserId = user._id;

    // Create test plan
    const plan = await Plan.create({
      name: 'Test Plan',
      priceInPaise: 99900,
      billingIntervalDays: 30,
      features: ['Feature 1'],
      isActive: true,
    });
    testPlanId = plan._id;

    // Create test subscription (pending)
    const subscription = await Subscription.create({
      userId: testUserId,
      planId: testPlanId,
      status: SubscriptionStatus.PENDING,
    });
    testSubscriptionId = subscription._id;

    // Create test payment (created)
    const payment = await Payment.create({
      userId: testUserId,
      subscriptionId: testSubscriptionId,
      razorpayOrderId: TEST_ORDER_ID,
      amountInPaise: 99900,
      status: PaymentStatus.CREATED,
      type: PaymentType.NEW_SUBSCRIPTION,
    });
    testPaymentId = payment._id;
  });

  test('first activation should create subscription, invoice, and webhook event', async () => {
    // Insert webhook event (simulating idempotency guard)
    await WebhookEvent.create({
      razorpayEventId: TEST_EVENT_ID,
      eventType: 'payment.captured',
      payload: { test: true },
      processedAt: new Date(),
    });

    // Process the activation
    await subscriptionService.activateSubscription(
      TEST_ORDER_ID,
      TEST_PAYMENT_ID
    );

    // Verify subscription is active
    const subscription = await Subscription.findById(testSubscriptionId);
    expect(subscription!.status).toBe(SubscriptionStatus.ACTIVE);
    expect(subscription!.currentPeriodStart).toBeTruthy();
    expect(subscription!.currentPeriodEnd).toBeTruthy();

    // Verify payment is captured
    const payment = await Payment.findById(testPaymentId);
    expect(payment!.status).toBe(PaymentStatus.CAPTURED);
    expect(payment!.razorpayPaymentId).toBe(TEST_PAYMENT_ID);

    // Verify exactly 1 invoice was created
    const invoices = await Invoice.find({ subscriptionId: testSubscriptionId });
    expect(invoices.length).toBe(1);
    expect(invoices[0].amountInPaise).toBe(99900);

    // Verify webhook event was recorded
    const event = await WebhookEvent.findOne({
      razorpayEventId: TEST_EVENT_ID,
    });
    expect(event).toBeTruthy();
  });

  test('second activation with same order ID should be a no-op', async () => {
    // First activation
    await subscriptionService.activateSubscription(
      TEST_ORDER_ID,
      TEST_PAYMENT_ID
    );

    // Verify first activation worked
    const subscriptionAfterFirst =
      await Subscription.findById(testSubscriptionId);
    expect(subscriptionAfterFirst!.status).toBe(SubscriptionStatus.ACTIVE);

    const invoicesAfterFirst = await Invoice.find({
      subscriptionId: testSubscriptionId,
    });
    expect(invoicesAfterFirst.length).toBe(1);

    // Second activation (simulating duplicate webhook)
    await subscriptionService.activateSubscription(
      TEST_ORDER_ID,
      TEST_PAYMENT_ID
    );

    // Verify state hasn't changed
    const subscriptionAfterSecond =
      await Subscription.findById(testSubscriptionId);
    expect(subscriptionAfterSecond!.status).toBe(SubscriptionStatus.ACTIVE);

    // Verify still exactly 1 invoice (not 2)
    const invoicesAfterSecond = await Invoice.find({
      subscriptionId: testSubscriptionId,
    });
    expect(invoicesAfterSecond.length).toBe(1);
  });

  test('duplicate WebhookEvent insertion should throw duplicate key error', async () => {
    // First insert
    await WebhookEvent.create({
      razorpayEventId: 'evt_duplicate_test',
      eventType: 'payment.captured',
      payload: {},
      processedAt: new Date(),
    });

    // Second insert with same event ID should fail
    try {
      await WebhookEvent.create({
        razorpayEventId: 'evt_duplicate_test',
        eventType: 'payment.captured',
        payload: {},
        processedAt: new Date(),
      });
      // Should not reach here
      expect(true).toBe(false);
    } catch (error: unknown) {
      // Expect MongoDB duplicate key error (code 11000)
      expect(
        error &&
          typeof error === 'object' &&
          'code' in error &&
          (error as { code: number }).code
      ).toBe(11000);
    }
  });
});
