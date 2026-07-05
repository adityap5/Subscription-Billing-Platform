import { describe, test, expect, beforeEach } from 'bun:test';
import mongoose from 'mongoose';
import { Subscription } from '../src/models/subscription.model';
import { Payment } from '../src/models/payment.model';
import { Invoice } from '../src/models/invoice.model';
import { Plan } from '../src/models/plan.model';
import { User } from '../src/models/user.model';
import * as subscriptionService from '../src/services/subscription.service';
import { SubscriptionStatus, PaymentStatus, PaymentType } from '../src/types';

/**
 * Subscription lifecycle transition tests.
 * Tests the full state machine: pending→active, active→canceled→expired,
 * and edge cases around out-of-order webhooks, scheduled downgrades, etc.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

let testUserId: mongoose.Types.ObjectId;
let basicPlan: any;
let proPlan: any;
let enterprisePlan: any;

describe('Subscription Lifecycle', () => {
  beforeEach(async () => {
    await Invoice.deleteMany({});
    await Payment.deleteMany({});
    await Subscription.deleteMany({});
    await Plan.deleteMany({});
    await User.deleteMany({});

    const user = await User.create({
      email: 'lifecycle@test.com',
      passwordHash: 'hashed',
      name: 'Test User',
    });
    testUserId = user._id;

    basicPlan = await Plan.create({
      name: 'Basic',
      priceInPaise: 49900,
      billingIntervalDays: 30,
      features: ['Basic feature'],
      isActive: true,
    });

    proPlan = await Plan.create({
      name: 'Pro',
      priceInPaise: 99900,
      billingIntervalDays: 30,
      features: ['Pro feature'],
      isActive: true,
    });

    enterprisePlan = await Plan.create({
      name: 'Enterprise',
      priceInPaise: 199900,
      billingIntervalDays: 30,
      features: ['Enterprise feature'],
      isActive: true,
    });
  });

  test('pending → active: payment captured activates subscription', async () => {
    const subscription = await Subscription.create({
      userId: testUserId,
      planId: basicPlan._id,
      status: SubscriptionStatus.PENDING,
    });

    await Payment.create({
      userId: testUserId,
      subscriptionId: subscription._id,
      razorpayOrderId: 'order_lifecycle_1',
      amountInPaise: 49900,
      status: PaymentStatus.CREATED,
      type: PaymentType.NEW_SUBSCRIPTION,
    });

    await subscriptionService.activateSubscription(
      'order_lifecycle_1',
      'pay_lifecycle_1'
    );

    const updated = await Subscription.findById(subscription._id);
    expect(updated!.status).toBe(SubscriptionStatus.ACTIVE);
    expect(updated!.currentPeriodStart).toBeTruthy();
    expect(updated!.currentPeriodEnd).toBeTruthy();

    // Period should be ~30 days from activation
    const periodDays =
      (updated!.currentPeriodEnd!.getTime() -
        updated!.currentPeriodStart!.getTime()) /
      MS_PER_DAY;
    expect(Math.round(periodDays)).toBe(30);

    // Invoice should be created
    const invoices = await Invoice.find({
      subscriptionId: subscription._id,
    });
    expect(invoices.length).toBe(1);
  });

  test('active → canceled: cancel sets cancelAtPeriodEnd', async () => {
    const now = new Date();
    const subscription = await Subscription.create({
      userId: testUserId,
      planId: basicPlan._id,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + 30 * MS_PER_DAY),
    });

    const result = await subscriptionService.cancelSubscription(
      subscription._id.toString(),
      testUserId.toString()
    );

    expect(result.status).toBe(SubscriptionStatus.CANCELED);
    expect(result.cancelAtPeriodEnd).toBe(true);
    // Still has the same period dates
    expect(result.currentPeriodEnd).toBeTruthy();
  });

  test('canceled → expired: batch job expires after period end', async () => {
    const pastDate = new Date(Date.now() - 2 * MS_PER_DAY);
    await Subscription.create({
      userId: testUserId,
      planId: basicPlan._id,
      status: SubscriptionStatus.CANCELED,
      cancelAtPeriodEnd: true,
      currentPeriodStart: new Date(pastDate.getTime() - 30 * MS_PER_DAY),
      currentPeriodEnd: pastDate, // Already past
    });

    const result = await subscriptionService.processScheduledTransitions();

    expect(result.expired).toBe(1);

    const subscriptions = await Subscription.find({
      userId: testUserId,
      status: SubscriptionStatus.EXPIRED,
    });
    expect(subscriptions.length).toBe(1);
  });

  test('pending → pending: failed payment leaves subscription pending', async () => {
    const subscription = await Subscription.create({
      userId: testUserId,
      planId: basicPlan._id,
      status: SubscriptionStatus.PENDING,
    });

    await Payment.create({
      userId: testUserId,
      subscriptionId: subscription._id,
      razorpayOrderId: 'order_failed_1',
      amountInPaise: 49900,
      status: PaymentStatus.CREATED,
      type: PaymentType.NEW_SUBSCRIPTION,
    });

    await subscriptionService.failPayment('order_failed_1');

    const updated = await Subscription.findById(subscription._id);
    expect(updated!.status).toBe(SubscriptionStatus.PENDING);

    const payment = await Payment.findOne({
      razorpayOrderId: 'order_failed_1',
    });
    expect(payment!.status).toBe(PaymentStatus.FAILED);

    // No invoice should be created
    const invoices = await Invoice.find({
      subscriptionId: subscription._id,
    });
    expect(invoices.length).toBe(0);
  });

  test('out-of-order: captured then failed → stays captured', async () => {
    const subscription = await Subscription.create({
      userId: testUserId,
      planId: basicPlan._id,
      status: SubscriptionStatus.PENDING,
    });

    await Payment.create({
      userId: testUserId,
      subscriptionId: subscription._id,
      razorpayOrderId: 'order_ooo_1',
      amountInPaise: 49900,
      status: PaymentStatus.CREATED,
      type: PaymentType.NEW_SUBSCRIPTION,
    });

    // First: captured
    await subscriptionService.activateSubscription(
      'order_ooo_1',
      'pay_ooo_1'
    );

    // Second: stale failed event (should be ignored)
    await subscriptionService.failPayment('order_ooo_1');

    const updated = await Subscription.findById(subscription._id);
    expect(updated!.status).toBe(SubscriptionStatus.ACTIVE);

    const payment = await Payment.findOne({ razorpayOrderId: 'order_ooo_1' });
    expect(payment!.status).toBe(PaymentStatus.CAPTURED);
  });

  test('cancel is idempotent (Edge #10)', async () => {
    const now = new Date();
    const subscription = await Subscription.create({
      userId: testUserId,
      planId: basicPlan._id,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + 30 * MS_PER_DAY),
    });

    // Cancel twice
    await subscriptionService.cancelSubscription(
      subscription._id.toString(),
      testUserId.toString()
    );
    const result = await subscriptionService.cancelSubscription(
      subscription._id.toString(),
      testUserId.toString()
    );

    expect(result.cancelAtPeriodEnd).toBe(true);
  });

  // --- Scheduled Downgrade Tests ---

  test('scheduled downgrade: sets pendingPlanId, batch job applies it', async () => {
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 1 * MS_PER_DAY); // Ends tomorrow

    const subscription = await Subscription.create({
      userId: testUserId,
      planId: proPlan._id,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: new Date(now.getTime() - 29 * MS_PER_DAY),
      currentPeriodEnd: periodEnd,
    });

    // Schedule downgrade
    const result = await subscriptionService.changePlan(
      subscription._id.toString(),
      basicPlan._id.toString(),
      testUserId.toString()
    );

    expect(result.type).toBe('downgrade');

    const afterSchedule = await Subscription.findById(subscription._id);
    expect(afterSchedule!.pendingPlanId!.toString()).toBe(
      basicPlan._id.toString()
    );
    expect(afterSchedule!.pendingPlanEffectiveAt).toBeTruthy();
    // Still on Pro plan
    expect(afterSchedule!.planId.toString()).toBe(proPlan._id.toString());

    // Simulate period end passing
    afterSchedule!.currentPeriodEnd = new Date(Date.now() - MS_PER_DAY);
    afterSchedule!.pendingPlanEffectiveAt = new Date(Date.now() - MS_PER_DAY);
    await afterSchedule!.save();

    // Run batch job
    const batchResult =
      await subscriptionService.processScheduledTransitions();
    expect(batchResult.planChanged).toBe(1);

    // Verify plan changed
    const afterBatch = await Subscription.findById(subscription._id);
    expect(afterBatch!.planId.toString()).toBe(basicPlan._id.toString());
    expect(afterBatch!.pendingPlanId).toBeNull();
    expect(afterBatch!.pendingPlanEffectiveAt).toBeNull();
    // Period should be rolled forward
    expect(afterBatch!.currentPeriodStart).toBeTruthy();
    expect(afterBatch!.currentPeriodEnd).toBeTruthy();
  });

  test('cancel overrides scheduled downgrade (Edge #17)', async () => {
    const now = new Date();
    const subscription = await Subscription.create({
      userId: testUserId,
      planId: proPlan._id,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: new Date(now.getTime() - 29 * MS_PER_DAY),
      currentPeriodEnd: new Date(now.getTime() + MS_PER_DAY),
    });

    // Schedule downgrade
    await subscriptionService.changePlan(
      subscription._id.toString(),
      basicPlan._id.toString(),
      testUserId.toString()
    );

    // Then cancel
    await subscriptionService.cancelSubscription(
      subscription._id.toString(),
      testUserId.toString()
    );

    // Simulate period end
    const sub = await Subscription.findById(subscription._id);
    sub!.currentPeriodEnd = new Date(Date.now() - MS_PER_DAY);
    await sub!.save();

    // Run batch job
    const result = await subscriptionService.processScheduledTransitions();
    expect(result.expired).toBe(1);
    expect(result.planChanged).toBe(0);

    // Subscription should be expired, not downgraded
    const final = await Subscription.findById(subscription._id);
    expect(final!.status).toBe(SubscriptionStatus.EXPIRED);
    expect(final!.pendingPlanId).toBeNull();
  });

  test('upgrade clears scheduled downgrade (Edge #18)', async () => {
    const now = new Date();
    const subscription = await Subscription.create({
      userId: testUserId,
      planId: proPlan._id,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: new Date(now.getTime() - 15 * MS_PER_DAY),
      currentPeriodEnd: new Date(now.getTime() + 15 * MS_PER_DAY),
    });

    // Schedule downgrade to Basic
    await subscriptionService.changePlan(
      subscription._id.toString(),
      basicPlan._id.toString(),
      testUserId.toString()
    );

    // Verify downgrade was scheduled
    let sub = await Subscription.findById(subscription._id);
    expect(sub!.pendingPlanId!.toString()).toBe(basicPlan._id.toString());

    // Now upgrade to Enterprise (should clear the scheduled downgrade)
    const upgradeResult = await subscriptionService.changePlan(
      subscription._id.toString(),
      enterprisePlan._id.toString(),
      testUserId.toString()
    );

    expect(upgradeResult.type).toBe('upgrade');

    // pendingPlanId should be cleared
    sub = await Subscription.findById(subscription._id);
    expect(sub!.pendingPlanId).toBeNull();
    expect(sub!.pendingPlanEffectiveAt).toBeNull();
  });

  test('second downgrade replaces first (Edge #19)', async () => {
    const now = new Date();
    const subscription = await Subscription.create({
      userId: testUserId,
      planId: enterprisePlan._id,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: new Date(now.getTime() - 15 * MS_PER_DAY),
      currentPeriodEnd: new Date(now.getTime() + 15 * MS_PER_DAY),
    });

    // First downgrade to Pro
    await subscriptionService.changePlan(
      subscription._id.toString(),
      proPlan._id.toString(),
      testUserId.toString()
    );

    let sub = await Subscription.findById(subscription._id);
    expect(sub!.pendingPlanId!.toString()).toBe(proPlan._id.toString());

    // Second downgrade to Basic (should replace Pro)
    await subscriptionService.changePlan(
      subscription._id.toString(),
      basicPlan._id.toString(),
      testUserId.toString()
    );

    sub = await Subscription.findById(subscription._id);
    expect(sub!.pendingPlanId!.toString()).toBe(basicPlan._id.toString());
  });
});
