import { Subscription, ISubscription } from '../../models/subscription.model';
import { Plan } from '../../models/plan.model';
import { Payment, IPayment } from '../../models/payment.model';
import { ApiError } from '../../utils/apiError';
import { logger } from '../../utils/logger';
import { SubscriptionStatus, PaymentStatus, PaymentType } from '../../types';
import * as razorpayService from '../razorpay.service';
import { STALE_PENDING_TTL_MS } from '../../utils/time';

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
  const plan = await Plan.findById(planId);
  if (!plan || !plan.isActive) {
    throw ApiError.notFound('Plan not found or inactive');
  }
  const existingActive = await Subscription.findOne({
    userId,
    status: { $in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.CANCELED] },
  });

  if (existingActive) {
    throw ApiError.conflict(
      'You already have an active subscription. Use upgrade/downgrade to change plans.'
    );
  }

  const existingPending = await Subscription.findOne({
    userId,
    status: SubscriptionStatus.PENDING,
  });

  if (existingPending) {
    const existingPayment = await Payment.findOne({
      subscriptionId: existingPending._id,
      status: PaymentStatus.CREATED,
    });

    if (existingPayment) {
      const paymentAge = Date.now() - existingPayment.createdAt.getTime();

      if (paymentAge < STALE_PENDING_TTL_MS) {
        if (existingPending.planId.toString() === planId) {
          const { RAZORPAY_KEY_ID } = (await import('../../config/env')).getEnv();

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
      existingPayment.status = PaymentStatus.FAILED;
      await existingPayment.save();
    }
    existingPending.status = SubscriptionStatus.EXPIRED;
    await existingPending.save();
  }

  // Create Razorpay Order
  const receipt = `sub_${userId.toString().slice(-8)}_${Date.now()}`;
  const order = await razorpayService.createOrder(plan.priceInPaise, receipt);

  // Create Subscription (pending)
  const subscription = await Subscription.create({
    userId,
    planId: plan._id,
    status: SubscriptionStatus.PENDING,
  });

  // Create Payment (created)
  const payment = await Payment.create({
    userId,
    subscriptionId: subscription._id,
    razorpayOrderId: order.id,
    amountInPaise: plan.priceInPaise,
    status: PaymentStatus.CREATED,
    type: PaymentType.NEW_SUBSCRIPTION,
  });

  const { RAZORPAY_KEY_ID } = (await import('../../config/env')).getEnv();

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