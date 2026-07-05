'use client';

import { Card, CardBody } from '@/components/ui/Card';
import { Badge, getStatusBadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { Subscription, Plan } from '@/lib/types';
import { formatPaise, formatDate } from '@/lib/types';

interface SubscriptionStatusCardProps {
  subscription: Subscription;
  onCancel: () => void;
  onChangePlan: () => void;
  isCancelling?: boolean;
}

export function SubscriptionStatusCard({
  subscription,
  onCancel,
  onChangePlan,
  isCancelling = false,
}: SubscriptionStatusCardProps) {
  const plan = subscription.planId as Plan;
  const pendingPlan = subscription.pendingPlanId as Plan | null;
  const isActive =
    subscription.status === 'active' || subscription.status === 'canceled';

  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Your Subscription
          </h2>
          <Badge variant={getStatusBadgeVariant(subscription.status)}>
            {subscription.status.charAt(0).toUpperCase() +
              subscription.status.slice(1)}
          </Badge>
        </div>

        {plan && typeof plan === 'object' && (
          <div>
            <p className="text-sm text-gray-500">Current Plan</p>
            <p className="text-xl font-bold text-gray-900">{plan.name}</p>
            <p className="text-sm text-gray-600">
              {formatPaise(plan.priceInPaise)} / {plan.billingIntervalDays} days
            </p>
          </div>
        )}

        {isActive && subscription.currentPeriodEnd && (
          <div>
            <p className="text-sm text-gray-500">
              {subscription.cancelAtPeriodEnd
                ? 'Access until'
                : 'Renews on'}
            </p>
            <p className="text-sm font-medium text-gray-900">
              {formatDate(subscription.currentPeriodEnd)}
            </p>
          </div>
        )}

        {subscription.cancelAtPeriodEnd && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-yellow-800">
              Your subscription will expire on{' '}
              {formatDate(subscription.currentPeriodEnd)}.
              {pendingPlan
                ? ' The scheduled plan change will be discarded.'
                : ''}
            </p>
          </div>
        )}

        {/* Pending plan display — shows scheduled downgrade */}
        {pendingPlan &&
          typeof pendingPlan === 'object' &&
          !subscription.cancelAtPeriodEnd && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                Switching to <strong>{pendingPlan.name}</strong> on{' '}
                {formatDate(subscription.pendingPlanEffectiveAt)}
              </p>
            </div>
          )}

        {subscription.status === 'active' && (
          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={onChangePlan}
            >
              Change Plan
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={onCancel}
              isLoading={isCancelling}
            >
              {subscription.cancelAtPeriodEnd
                ? 'Already Cancelling'
                : pendingPlan
                ? 'Cancel (discards plan change)'
                : 'Cancel Subscription'}
            </Button>
          </div>
        )}

        {subscription.status === 'pending' && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <p className="text-sm text-gray-600">
              Your subscription is pending payment. Complete the checkout to
              activate it.
            </p>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
