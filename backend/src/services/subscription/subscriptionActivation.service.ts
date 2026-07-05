import { Subscription, ISubscription } from '../../models/subscription.model';
import { Payment, IPayment } from '../../models/payment.model';
import { Plan } from '../../models/plan.model';
import { User } from '../../models/user.model';
import { logger } from '../../utils/logger';
import { SubscriptionStatus, PaymentStatus, PaymentType } from '../../types';
import * as invoiceService from '../invoice.service';
import * as notificationService from '../notification.service';
import { MS_PER_DAY } from '../../utils/time';

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

  if (payment.status === PaymentStatus.CAPTURED) {
    logger.info('Ignoring failed event for already-captured payment (out-of-order webhook)', {
      paymentId: payment._id.toString(),
      razorpayOrderId,
    });
    return;
  }

  if (payment.status === PaymentStatus.FAILED) {
    return;
  }

  payment.status = PaymentStatus.FAILED;
  await payment.save();

  // Subscription stays in its current state
  logger.info('Payment marked as failed', {
    paymentId: payment._id.toString(),
    razorpayOrderId,
  });

  // Send failure email
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