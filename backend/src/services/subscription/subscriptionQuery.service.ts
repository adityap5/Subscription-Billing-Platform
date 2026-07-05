import { Subscription, ISubscription } from '../../models/subscription.model';
import { SubscriptionStatus } from '../../types';
import * as invoiceService from '../invoice.service';

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
        SubscriptionStatus.EXPIRED,
      ],
    },
  })
    .populate('planId')
    .populate('pendingPlanId')
    .sort({ createdAt: -1 });
}

export async function getUserInvoices(userId: string) {
  return invoiceService.getUserInvoices(userId);
}