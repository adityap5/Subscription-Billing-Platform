import { Subscription, ISubscription } from '../../models/subscription.model';
import { Plan, IPlan } from '../../models/plan.model';
import { Payment } from '../../models/payment.model';
import { User } from '../../models/user.model';
import { ApiError } from '../../utils/apiError';
import { logger } from '../../utils/logger';
import { SubscriptionStatus, PaymentStatus, PaymentType } from '../../types';
import * as notificationService from '../notification.service';
import * as razorpayService from '../razorpay.service';
import { calculateProration } from '../proration.service';
import { STALE_PENDING_TTL_MS } from '../../utils/time';

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

// Changes a subscription's plan
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

  const { RAZORPAY_KEY_ID } = (await import('../../config/env')).getEnv();

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