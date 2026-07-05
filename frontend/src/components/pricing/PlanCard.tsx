'use client';

import { Card, CardBody, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { Plan } from '@/lib/types';
import { formatPaise } from '@/lib/types';

interface PlanCardProps {
  plan: Plan;
  isCurrentPlan?: boolean;
  onSelect: (planId: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export function PlanCard({
  plan,
  isCurrentPlan = false,
  onSelect,
  isLoading = false,
  disabled = false,
}: PlanCardProps) {
  return (
    <Card
      className={`flex flex-col ${
        isCurrentPlan ? 'ring-2 ring-indigo-600' : ''
      }`}
    >
      <CardBody className="flex-1">
        {isCurrentPlan && (
          <span className="inline-block mb-2 px-2 py-1 text-xs font-semibold text-indigo-600 bg-indigo-50 rounded-full">
            Current Plan
          </span>
        )}
        <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
        <div className="mt-2">
          <span className="text-3xl font-bold text-gray-900">
            {formatPaise(plan.priceInPaise)}
          </span>
          <span className="text-sm text-gray-500">
            /{plan.billingIntervalDays} days
          </span>
        </div>
        <ul className="mt-4 space-y-2">
          {plan.features.map((feature, i) => (
            <li key={i} className="flex items-center text-sm text-gray-600">
              <svg
                className="h-4 w-4 text-green-500 mr-2 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              {feature}
            </li>
          ))}
        </ul>
      </CardBody>
      <CardFooter>
        <Button
          variant={isCurrentPlan ? 'secondary' : 'primary'}
          className="w-full"
          onClick={() => onSelect(plan._id)}
          isLoading={isLoading}
          disabled={disabled || isCurrentPlan}
        >
          {isCurrentPlan ? 'Current Plan' : 'Subscribe'}
        </Button>
      </CardFooter>
    </Card>
  );
}
