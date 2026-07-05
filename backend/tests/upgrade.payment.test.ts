import { describe, test, expect, beforeEach } from 'bun:test';
import mongoose from 'mongoose';
import { Subscription } from '../src/models/subscription.model';
import { Payment } from '../src/models/payment.model';
import { Invoice } from '../src/models/invoice.model';
import { Plan } from '../src/models/plan.model';
import { User } from '../src/models/user.model';
import * as subscriptionService from '../src/services/subscription';
import { SubscriptionStatus, PaymentStatus, PaymentType } from '../src/types';

/**
 * Upgrade payment webhook tests.
 * Verifies that payment.captured for an upgrade Payment:
 * - Updates planId to the new plan
 * - Does NOT reset currentPeriodStart/currentPeriodEnd
 * - Clears pendingPlanId/pendingPlanEffectiveAt
 * - Creates an invoice for the prorated amount
 * - Is idempotent (second call is no-op)
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

let testUserId: mongoose.Types.ObjectId;
let basicPlan: any;
let proPlan: any;

describe('Upgrade Payment Webhook', () => {
  beforeEach(async () => {
    await Invoice.deleteMany({});
    await Payment.deleteMany({});
    await Subscription.deleteMany({});
    await Plan.deleteMany({});
    await User.deleteMany({});

    const user = await User.create({
      email: 'upgrade@test.com',
      passwordHash: 'hashed',
      name: 'Upgrade User',
    });
    testUserId = user._id;

    basicPlan = await Plan.create({
      name: 'Basic',
      priceInPaise: 49900,
      billingIntervalDays: 30,
      features: ['Basic'],
      isActive: true,
    });

    proPlan = await Plan.create({
      name: 'Pro',
      priceInPaise: 99900,
      billingIntervalDays: 30,
      features: ['Pro'],
      isActive: true,
    });
  });

  test('upgrade payment applies plan change without resetting period dates', async () => {
    const now = new Date();
    const periodStart = new Date(now.getTime() - 15 * MS_PER_DAY);
    const periodEnd = new Date(now.getTime() + 15 * MS_PER_DAY);

    const subscription = await Subscription.create({
      userId: testUserId,
      planId: basicPlan._id,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
    });

    // Create upgrade payment
    await Payment.create({
      userId: testUserId,
      subscriptionId: subscription._id,
      razorpayOrderId: 'order_upgrade_1',
      amountInPaise: 25000, // prorated amount
      status: PaymentStatus.CREATED,
      type: PaymentType.UPGRADE,
      targetPlanId: proPlan._id,
    });

    // Simulate payment.captured webhook
    await subscriptionService.activateSubscription(
      'order_upgrade_1',
      'pay_upgrade_1'
    );

    const updated = await Subscription.findById(subscription._id);

    // Plan should be updated to Pro
    expect(updated!.planId.toString()).toBe(proPlan._id.toString());

    // Period dates should NOT be reset
    expect(updated!.currentPeriodStart!.getTime()).toBe(periodStart.getTime());
    expect(updated!.currentPeriodEnd!.getTime()).toBe(periodEnd.getTime());

    // pendingPlanId should be cleared (defensive guard)
    expect(updated!.pendingPlanId).toBeNull();
    expect(updated!.pendingPlanEffectiveAt).toBeNull();

    // Subscription should still be active
    expect(updated!.status).toBe(SubscriptionStatus.ACTIVE);

    // Invoice should be created for prorated amount
    const invoices = await Invoice.find({
      subscriptionId: subscription._id,
    });
    expect(invoices.length).toBe(1);
    expect(invoices[0].amountInPaise).toBe(25000);
    expect(invoices[0].description).toContain('Upgrade');
  });

  test('upgrade payment is idempotent (second call is no-op)', async () => {
    const now = new Date();
    const periodStart = new Date(now.getTime() - 15 * MS_PER_DAY);
    const periodEnd = new Date(now.getTime() + 15 * MS_PER_DAY);

    const subscription = await Subscription.create({
      userId: testUserId,
      planId: basicPlan._id,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
    });

    await Payment.create({
      userId: testUserId,
      subscriptionId: subscription._id,
      razorpayOrderId: 'order_upgrade_idem',
      amountInPaise: 25000,
      status: PaymentStatus.CREATED,
      type: PaymentType.UPGRADE,
      targetPlanId: proPlan._id,
    });

    // First activation
    await subscriptionService.activateSubscription(
      'order_upgrade_idem',
      'pay_upgrade_idem'
    );

    // Second activation (duplicate webhook)
    await subscriptionService.activateSubscription(
      'order_upgrade_idem',
      'pay_upgrade_idem'
    );

    // Should still have exactly 1 invoice
    const invoices = await Invoice.find({
      subscriptionId: subscription._id,
    });
    expect(invoices.length).toBe(1);

    // Payment should still be captured
    const payment = await Payment.findOne({
      razorpayOrderId: 'order_upgrade_idem',
    });
    expect(payment!.status).toBe(PaymentStatus.CAPTURED);
  });
});
