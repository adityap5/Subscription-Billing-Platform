import mongoose from 'mongoose';
import { Subscription, ISubscription } from '../models/subscription.model';
import { Plan, IPlan } from '../models/plan.model';
import { Payment, IPayment } from '../models/payment.model';
import { User } from '../models/user.model';
import { ApiError } from '../utils/apiError';
import { logger } from '../utils/logger';
import { SubscriptionStatus, PaymentStatus, PaymentType } from '../types';
import * as razorpayService from './razorpay.service';
import * as invoiceService from './invoice.service';
import * as notificationService from './notification.service';
import { calculateProration } from './proration.service';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const STALE_PENDING_TTL_MS = 24 * 60 * 60 * 1000;

// Creates a new subscription for a user.
export async function createSubscription(
  userId: string,
  planId: string
): Promise<{
  subscription: ISubscription;
  payment: IPayment;
  orderId: string;
  amount: number;
  keyId: string;
}> {
  // Fetch the plan
  const plan = await Plan.findById(planId);
  if (!plan || !plan.isActive) {
    throw ApiError.notFound('Plan not found or inactive');
  }

  // Check if user already has an active or pending subscription
  const existingActive = await Subscription.findOne({
    userId,
    status: { $in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.CANCELED] },
  });

  if (existingActive) {
    throw ApiError.conflict(
      'You already have an active subscription. Use upgrade/downgrade to change plans.'
    );
  }

  // Check for existing pending subscription for same user
  const existingPending = await Subscription.findOne({
    userId,
    status: SubscriptionStatus.PENDING,
  });

  if (existingPending) {
    // Check if there's a pending payment for it
    const existingPayment = await Payment.findOne({
      subscriptionId: existingPending._id,
      status: PaymentStatus.CREATED,
    });

    if (existingPayment) {
      const paymentAge = Date.now() - existingPayment.createdAt.getTime();

      if (paymentAge < STALE_PENDING_TTL_MS) {
        // Reuse the existing pending subscription if same plan
        if (existingPending.planId.toString() === planId) {
          const { RAZORPAY_KEY_ID } = (await import('../config/env')).getEnv();

          logger.info('Reusing existing pending subscription', {
            subscriptionId: existingPending._id.toString(),
            orderId: existingPayment.razorpayOrderId,
          });

          return {
            subscription: existingPending,
            payment: existingPayment,
            orderId: existingPayment.razorpayOrderId,
            amount: existingPayment.amountInPaise,
            keyId: RAZORPAY_KEY_ID,
          };
        }
      }

      // Stale or different plan — mark old payment as failed
      existingPayment.status = PaymentStatus.FAILED;
      await existingPayment.save();
    }

    // Mark old subscription as expired
    existingPending.status = SubscriptionStatus.EXPIRED;
    await existingPending.save();
  }

  // Create Razorpay Order — amount from Plan, not client (receipt max 40 chars)
  const receipt = `sub_${userId.toString().slice(-8)}_${Date.now()}`;
  const order = await razorpayService.createOrder(plan.priceInPaise, receipt);

  // Create Subscription (pending)
  const subscription = await Subscription.create({
    userId,
    planId: plan._id,
    status: SubscriptionStatus.PENDING,
  });

  // Create Payment (created) — razorpayOrderId stored on Payment, not Subscription (Decision #11)
  const payment = await Payment.create({
    userId,
    subscriptionId: subscription._id,
    razorpayOrderId: order.id,
    amountInPaise: plan.priceInPaise,
    status: PaymentStatus.CREATED,
    type: PaymentType.NEW_SUBSCRIPTION,
  });

  const { RAZORPAY_KEY_ID } = (await import('../config/env')).getEnv();

  logger.info('Subscription created', {
    subscriptionId: subscription._id.toString(),
    planId,
    orderId: order.id,
    amountInPaise: plan.priceInPaise,
  });

  return {
    subscription,
    payment,
    orderId: order.id,
    amount: plan.priceInPaise,
    keyId: RAZORPAY_KEY_ID,
  };
}

//Activates a subscription after payment is captured.
export async function activateSubscription(
  razorpayOrderId: string,
  razorpayPaymentId: string
): Promise<void> {
  // Find the Payment by razorpayOrderId
  const payment = await Payment.findOne({ razorpayOrderId });
  if (!payment) {
    logger.warn('Payment not found for order', { razorpayOrderId });
    return;
  }

  // Edge #8: captured is terminal — don't re-process
  if (payment.status === PaymentStatus.CAPTURED) {
    logger.info('Payment already captured, skipping', {
      paymentId: payment._id.toString(),
      razorpayOrderId,
    });
    return;
  }

  const subscription = await Subscription.findById(payment.subscriptionId);
  if (!subscription) {
    logger.error('Subscription not found for payment', {
      paymentId: payment._id.toString(),
      subscriptionId: payment.subscriptionId.toString(),
    });
    return;
  }

  // Edge #13: Don't reactivate expired subscriptions from stale webhooks
  if (subscription.status === SubscriptionStatus.EXPIRED) {
    logger.warn('Ignoring captured payment for expired subscription (late webhook)', {
      subscriptionId: subscription._id.toString(),
      razorpayOrderId,
    });
    return;
  }

  // Mark payment captured
  payment.status = PaymentStatus.CAPTURED;
  payment.razorpayPaymentId = razorpayPaymentId;
  await payment.save();

  // Fetch user for email
  const user = await User.findById(payment.userId);
  const userEmail = user?.email || '';

  // Branch on Payment.type
  if (payment.type === PaymentType.NEW_SUBSCRIPTION) {
    await handleNewSubscriptionCapture(subscription, payment, userEmail);
  } else if (payment.type === PaymentType.UPGRADE) {
    await handleUpgradeCapture(subscription, payment, userEmail);
  } else {
    logger.warn('Unhandled payment type for activation', {
      type: payment.type,
      paymentId: payment._id.toString(),
    });
  }
}

// Handles payment.captured for a new subscription.
// Sets period dates, flips pending→active, generates invoice, sends email.
async function handleNewSubscriptionCapture(
  subscription: ISubscription,
  payment: IPayment,
  userEmail: string
): Promise<void> {
  const plan = await Plan.findById(subscription.planId);
  if (!plan) {
    logger.error('Plan not found', { planId: subscription.planId.toString() });
    return;
  }

  const now = new Date();
  const periodEnd = new Date(
    now.getTime() + plan.billingIntervalDays * MS_PER_DAY
  );

  // Flip subscription to active with period dates
  subscription.status = SubscriptionStatus.ACTIVE;
  subscription.currentPeriodStart = now;
  subscription.currentPeriodEnd = periodEnd;
  await subscription.save();

  // Generate invoice
  const invoice = await invoiceService.createInvoice(
    payment.userId.toString(),
    subscription._id.toString(),
    payment._id.toString(),
    payment.amountInPaise,
    `New subscription to ${plan.name}`
  );

  logger.info('New subscription activated', {
    subscriptionId: subscription._id.toString(),
    planName: plan.name,
    periodEnd: periodEnd.toISOString(),
  });

  // Edge #14: emails fire-and-forget — failures logged, never block
  await notificationService.sendPaymentConfirmation(
    userEmail,
    plan.name,
    payment.amountInPaise,
    periodEnd
  );

  await notificationService.sendInvoiceEmail(
    userEmail,
    `New subscription to ${plan.name}`,
    payment.amountInPaise,
    invoice.issuedAt
  );
}

// Handles payment.captured for an upgrade.
async function handleUpgradeCapture(
  subscription: ISubscription,
  payment: IPayment,
  userEmail: string
): Promise<void> {
  const oldPlan = await Plan.findById(subscription.planId);
  const newPlan = await Plan.findById(payment.targetPlanId);

  if (!newPlan) {
    logger.error('Target plan not found for upgrade', {
      targetPlanId: payment.targetPlanId?.toString(),
    });
    return;
  }

  const oldPlanName = oldPlan?.name || 'Unknown';

  // Switch to new plan — DO NOT reset period dates
  subscription.planId = newPlan._id;
  // Clear pending plan fields as defensive guard
  subscription.pendingPlanId = null;
  subscription.pendingPlanEffectiveAt = null;
  await subscription.save();

  // Generate invoice for prorated amount
  const invoice = await invoiceService.createInvoice(
    payment.userId.toString(),
    subscription._id.toString(),
    payment._id.toString(),
    payment.amountInPaise,
    `Upgrade to ${newPlan.name} — prorated`
  );

  logger.info('Subscription upgraded', {
    subscriptionId: subscription._id.toString(),
    oldPlan: oldPlanName,
    newPlan: newPlan.name,
    proratedAmount: payment.amountInPaise,
  });

  // Edge #14: emails fire-and-forget
  await notificationService.sendPlanUpgraded(
    userEmail,
    oldPlanName,
    newPlan.name,
    payment.amountInPaise
  );

  await notificationService.sendInvoiceEmail(
    userEmail,
    `Upgrade to ${newPlan.name} — prorated`,
    payment.amountInPaise,
    invoice.issuedAt
  );
}

// Handles a failed payment.
export async function failPayment(razorpayOrderId: string): Promise<void> {
  const payment = await Payment.findOne({ razorpayOrderId });
  if (!payment) {
    logger.warn('Payment not found for failed order', { razorpayOrderId });
    return;
  }

  // Edge #8: captured is terminal — ignore stale failed event
  if (payment.status === PaymentStatus.CAPTURED) {
    logger.info('Ignoring failed event for already-captured payment (out-of-order webhook)', {
      paymentId: payment._id.toString(),
      razorpayOrderId,
    });
    return;
  }

  // Already failed — no-op
  if (payment.status === PaymentStatus.FAILED) {
    return;
  }

  payment.status = PaymentStatus.FAILED;
  await payment.save();

  // Subscription stays in its current state (pending for new, active for upgrade)
  // Edge #2: No invoice generated

  logger.info('Payment marked as failed', {
    paymentId: payment._id.toString(),
    razorpayOrderId,
  });

  // Send failure email (fire-and-forget)
  const user = await User.findById(payment.userId);
  const plan = await Plan.findById(
    (await Subscription.findById(payment.subscriptionId))?.planId
  );

  if (user && plan) {
    await notificationService.sendPaymentFailed(
      user.email,
      plan.name,
      payment.amountInPaise
    );
  }
}

// Cancels a subscription.
export async function cancelSubscription(
  subscriptionId: string,
  userId: string
): Promise<ISubscription> {
  const subscription = await Subscription.findOne({
    _id: subscriptionId,
    userId,
  });

  if (!subscription) {
    throw ApiError.notFound('Subscription not found');
  }

  if (subscription.status !== SubscriptionStatus.ACTIVE &&
      subscription.status !== SubscriptionStatus.CANCELED) {
    throw ApiError.badRequest(
      `Cannot cancel subscription in ${subscription.status} state`
    );
  }

  // Edge #10: already-canceled is idempotent no-op
  if (subscription.cancelAtPeriodEnd) {
    logger.info('Subscription already set to cancel at period end', {
      subscriptionId: subscription._id.toString(),
    });
    return subscription;
  }

  subscription.status = SubscriptionStatus.CANCELED;
  subscription.cancelAtPeriodEnd = true;
  // Edge #17: Do NOT clear pendingPlanId — batch job discards it at period end
  await subscription.save();

  logger.info('Subscription canceled (at period end)', {
    subscriptionId: subscription._id.toString(),
    currentPeriodEnd: subscription.currentPeriodEnd?.toISOString(),
  });

  // Send cancellation email
  const user = await User.findById(userId);
  const plan = await Plan.findById(subscription.planId);
  if (user && plan && subscription.currentPeriodEnd) {
    await notificationService.sendCancellationConfirmation(
      user.email,
      plan.name,
      subscription.currentPeriodEnd
    );
  }

  return subscription;
}

// Changes a subscription's plan (upgrade or downgrade).
export async function changePlan(
  subscriptionId: string,
  newPlanId: string,
  userId: string
): Promise<{
  type: 'upgrade' | 'downgrade';
  subscription: ISubscription;
  orderId?: string;
  amount?: number;
  keyId?: string;
}> {
  const subscription = await Subscription.findOne({
    _id: subscriptionId,
    userId,
    status: { $in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.CANCELED] },
  });

  if (!subscription) {
    throw ApiError.notFound('Active subscription not found');
  }

  if (subscription.status === SubscriptionStatus.CANCELED) {
    throw ApiError.badRequest(
      'Cannot change plan on a canceled subscription'
    );
  }

  const currentPlan = await Plan.findById(subscription.planId);
  const newPlan = await Plan.findById(newPlanId);

  if (!currentPlan) {
    throw ApiError.internal('Current plan not found');
  }
  if (!newPlan || !newPlan.isActive) {
    throw ApiError.notFound('New plan not found or inactive');
  }

  if (currentPlan._id.toString() === newPlan._id.toString()) {
    throw ApiError.badRequest('Already on this plan');
  }

  // UPGRADE: new plan costs more
  if (newPlan.priceInPaise > currentPlan.priceInPaise) {
    return handleUpgrade(subscription, currentPlan, newPlan, userId);
  }

  // DOWNGRADE or LATERAL: new plan costs same or less
  return handleDowngrade(subscription, currentPlan, newPlan, userId);
}

// Handles upgrade
async function handleUpgrade(
  subscription: ISubscription,
  currentPlan: IPlan,
  newPlan: IPlan,
  userId: string
): Promise<{
  type: 'upgrade';
  subscription: ISubscription;
  orderId: string;
  amount: number;
  keyId: string;
}> {
  // Edge #11: Check for existing pending upgrade payment
  const existingUpgradePayment = await Payment.findOne({
    subscriptionId: subscription._id,
    status: PaymentStatus.CREATED,
    type: PaymentType.UPGRADE,
  });

  if (existingUpgradePayment) {
    const paymentAge = Date.now() - existingUpgradePayment.createdAt.getTime();
    if (paymentAge < STALE_PENDING_TTL_MS) {
      throw ApiError.conflict(
        'An upgrade payment is already pending. Please complete or wait for it to expire.'
      );
    }
    // Stale — mark as failed
    existingUpgradePayment.status = PaymentStatus.FAILED;
    await existingUpgradePayment.save();
  }

  // Edge #18: Clear any scheduled downgrade
  subscription.pendingPlanId = null;
  subscription.pendingPlanEffectiveAt = null;

  if (!subscription.currentPeriodStart || !subscription.currentPeriodEnd) {
    throw ApiError.internal('Subscription period dates are not set');
  }

  // Compute proration
  const proration = calculateProration(
    currentPlan,
    newPlan,
    subscription.currentPeriodStart,
    subscription.currentPeriodEnd
  );

  if (proration.amountInPaise <= 0) {
    // Edge case: upgrade but prorated amount is 0 (e.g., last moment of cycle)
    // Treat as immediate switch with no charge
    subscription.planId = newPlan._id;
    await subscription.save();

    logger.info('Upgrade with zero proration — immediate switch', {
      subscriptionId: subscription._id.toString(),
      newPlan: newPlan.name,
    });

    return {
      type: 'upgrade',
      subscription,
      orderId: '',
      amount: 0,
      keyId: '',
    };
  }

  // Create Razorpay Order for prorated amount (receipt max 40 chars)
  const receipt = `upg_${subscription._id.toString().slice(-8)}_${Date.now()}`;
  const order = await razorpayService.createOrder(
    proration.amountInPaise,
    receipt
  );

  // Create Payment for upgrade
  await Payment.create({
    userId,
    subscriptionId: subscription._id,
    razorpayOrderId: order.id,
    amountInPaise: proration.amountInPaise,
    status: PaymentStatus.CREATED,
    type: PaymentType.UPGRADE,
    targetPlanId: newPlan._id,
  });

  await subscription.save();

  const { RAZORPAY_KEY_ID } = (await import('../config/env')).getEnv();

  logger.info('Upgrade order created', {
    subscriptionId: subscription._id.toString(),
    oldPlan: currentPlan.name,
    newPlan: newPlan.name,
    proratedAmount: proration.amountInPaise,
    orderId: order.id,
  });

  return {
    type: 'upgrade',
    subscription,
    orderId: order.id,
    amount: proration.amountInPaise,
    keyId: RAZORPAY_KEY_ID,
  };
}

// Handles downgrade
async function handleDowngrade(
  subscription: ISubscription,
  currentPlan: IPlan,
  newPlan: IPlan,
  userId: string
): Promise<{
  type: 'downgrade';
  subscription: ISubscription;
}> {
  // Schedule the plan change for period end
  subscription.pendingPlanId = newPlan._id;
  subscription.pendingPlanEffectiveAt = subscription.currentPeriodEnd;
  await subscription.save();

  logger.info('Downgrade scheduled', {
    subscriptionId: subscription._id.toString(),
    currentPlan: currentPlan.name,
    newPlan: newPlan.name,
    effectiveAt: subscription.currentPeriodEnd?.toISOString(),
  });

  // Send scheduled-change confirmation email
  const user = await User.findById(userId);
  if (user && subscription.currentPeriodEnd) {
    await notificationService.sendDowngradeScheduled(
      user.email,
      currentPlan.name,
      newPlan.name,
      subscription.currentPeriodEnd
    );
  }

  return {
    type: 'downgrade',
    subscription,
  };
}

// Batch job: processes scheduled transitions for subscriptions
export async function processScheduledTransitions(): Promise<{
  expired: number;
  planChanged: number;
  renewalsDue: number;
}> {
  const now = new Date();
  let expired = 0;
  let planChanged = 0;
  let renewalsDue = 0;

  // Find all subscriptions past their period end that are active or canceled
  const dueSubscriptions = await Subscription.find({
    status: { $in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.CANCELED] },
    currentPeriodEnd: { $lte: now },
  });

  for (const subscription of dueSubscriptions) {
    // Priority 1: Cancellation wins
    if (subscription.cancelAtPeriodEnd) {
      subscription.status = SubscriptionStatus.EXPIRED;
      // Discard any scheduled downgrade — don't apply plan change to expired sub
      subscription.pendingPlanId = null;
      subscription.pendingPlanEffectiveAt = null;
      await subscription.save();

      logger.info('Subscription expired (cancel at period end)', {
        subscriptionId: subscription._id.toString(),
      });

      expired++;
      continue;
    }

    // Priority 2: Apply pending plan change (scheduled downgrade)
    if (subscription.pendingPlanId) {
      const newPlan = await Plan.findById(subscription.pendingPlanId);

      if (newPlan && newPlan.isActive) {
        const oldPeriodEnd = subscription.currentPeriodEnd!;

        subscription.planId = subscription.pendingPlanId;
        subscription.pendingPlanId = null;
        subscription.pendingPlanEffectiveAt = null;
        // Roll period forward based on new plan's billing interval
        subscription.currentPeriodStart = oldPeriodEnd;
        subscription.currentPeriodEnd = new Date(
          oldPeriodEnd.getTime() + newPlan.billingIntervalDays * MS_PER_DAY
        );
        await subscription.save();

        logger.info('Scheduled plan change applied', {
          subscriptionId: subscription._id.toString(),
          newPlanId: newPlan._id.toString(),
          newPlanName: newPlan.name,
          newPeriodEnd: subscription.currentPeriodEnd.toISOString(),
        });

        planChanged++;
      } else {
        // Pending plan no longer exists/active — clear and continue as renewal
        subscription.pendingPlanId = null;
        subscription.pendingPlanEffectiveAt = null;
        await subscription.save();

        logger.warn('Pending plan not found or inactive, skipping change', {
          subscriptionId: subscription._id.toString(),
          pendingPlanId: subscription.pendingPlanId?.toString(),
        });
      }
      continue;
    }

    // Priority 3: Normal renewal
    // TODO: trigger renewal billing here — create a new Razorpay Order
    // for the current plan's price, same pipeline as new subscription
    renewalsDue++;
    logger.info('Subscription due for renewal (not implemented)', {
      subscriptionId: subscription._id.toString(),
    });
  }

  // Also handle stale pending subscriptions (Decision #4: 24h TTL)
  const stalePending = await Subscription.find({
    status: SubscriptionStatus.PENDING,
    createdAt: { $lte: new Date(now.getTime() - STALE_PENDING_TTL_MS) },
  });

  for (const sub of stalePending) {
    sub.status = SubscriptionStatus.EXPIRED;
    await sub.save();

    // Mark associated pending payments as failed
    await Payment.updateMany(
      { subscriptionId: sub._id, status: PaymentStatus.CREATED },
      { status: PaymentStatus.FAILED }
    );

    logger.info('Stale pending subscription expired', {
      subscriptionId: sub._id.toString(),
    });

    expired++;
  }

  return { expired, planChanged, renewalsDue };
}

// Gets the current subscription for a user.
export async function getCurrentSubscription(
  userId: string
): Promise<ISubscription | null> {
  return Subscription.findOne({
    userId,
    status: {
      $in: [
        SubscriptionStatus.ACTIVE,
        SubscriptionStatus.CANCELED,
        SubscriptionStatus.PENDING,
      ],
    },
  })
    .populate('planId')
    .populate('pendingPlanId')
    .sort({ createdAt: -1 });
}

// Gets all invoices for a user.
export async function getUserInvoices(userId: string) {
  return invoiceService.getUserInvoices(userId);
}