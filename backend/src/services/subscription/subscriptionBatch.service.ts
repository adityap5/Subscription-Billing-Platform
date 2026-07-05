import { Subscription } from '../../models/subscription.model';
import { Plan } from '../../models/plan.model';
import { Payment } from '../../models/payment.model';
import { logger } from '../../utils/logger';
import { SubscriptionStatus, PaymentStatus } from '../../types';
import { MS_PER_DAY, STALE_PENDING_TTL_MS } from '../../utils/time';

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

  const dueSubscriptions = await Subscription.find({
    status: { $in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.CANCELED] },
    currentPeriodEnd: { $lte: now },
  });

  for (const subscription of dueSubscriptions) {
    // Priority 1: Cancellation wins
    if (subscription.cancelAtPeriodEnd) {
      subscription.status = SubscriptionStatus.EXPIRED;
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
    renewalsDue++;
    logger.info('Subscription due for renewal (not implemented)', {
      subscriptionId: subscription._id.toString(),
    });
  }

  // Also handle stale pending subscriptions
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