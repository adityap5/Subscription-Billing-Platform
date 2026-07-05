'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import * as plansApi from '@/lib/api/plans';
import * as subscriptionApi from '@/lib/api/subscriptions';
import type { Plan } from '@/lib/types';
import { PlanCard } from '@/components/pricing/PlanCard';
import { Spinner } from '@/components/ui/Spinner';
import { PaymentButton } from '@/components/checkout/PaymentButton';

export default function PricingPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [isProcessingId, setIsProcessingId] = useState<string | null>(null);

  // Checkout state
  const [checkoutData, setCheckoutData] = useState<{
    orderId: string;
    amount: number;
    keyId: string;
    planName: string;
  } | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const plansData = await plansApi.getPlans();
        setPlans(plansData);

        if (isAuthenticated) {
          const currentSub = await subscriptionApi.getCurrentSubscription();
          if (currentSub && (currentSub.status === 'active' || currentSub.status === 'canceled')) {
            setCurrentPlanId(
              typeof currentSub.planId === 'string'
                ? currentSub.planId
                : currentSub.planId._id
            );
          }
        }
      } catch (err: any) {
        setError('Failed to load plans. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [isAuthenticated]);

  const handleSelectPlan = async (planId: string) => {
    if (!isAuthenticated) {
      router.push(`/login?redirect=/pricing`);
      return;
    }

    const selectedPlan = plans.find((p) => p._id === planId);
    if (!selectedPlan) return;

    try {
      setIsProcessingId(planId);
      setError(null);

      if (currentPlanId) {
        // Upgrade / Downgrade flow
        const currentSub = await subscriptionApi.getCurrentSubscription();
        if (!currentSub) throw new Error('No active subscription found');

        const changeResult = await subscriptionApi.changePlan(currentSub._id, planId);

        if (changeResult.type === 'upgrade' && 'orderId' in changeResult && changeResult.orderId) {
          setCheckoutData({
            orderId: changeResult.orderId,
            amount: changeResult.amount,
            keyId: changeResult.keyId,
            planName: selectedPlan.name,
          });
        } else {
          router.push('/dashboard');
        }
      } else {
        // New subscription flow
        const result = await subscriptionApi.createSubscription(planId);
        setCheckoutData({
          orderId: result.orderId,
          amount: result.amount,
          keyId: result.keyId,
          planName: selectedPlan.name,
        });
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to process request');
    } finally {
      setIsProcessingId(null);
    }
  };

  const handlePaymentSuccess = () => {
    router.push('/dashboard?payment=success');
  };

  if (isLoading) {
    return <div className="py-20"><Spinner /></div>;
  }

  if (checkoutData) {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <h2 className="text-2xl font-bold mb-4">Complete Payment</h2>
        <p className="text-gray-600 mb-8">
          You are subscribing to the {checkoutData.planName} plan.
        </p>
        <PaymentButton
          orderId={checkoutData.orderId}
          amount={checkoutData.amount}
          keyId={checkoutData.keyId}
          onSuccess={handlePaymentSuccess}
          onDismiss={() => setCheckoutData(null)}
          label={`Pay ₹${(checkoutData.amount / 100).toFixed(2)}`}
        />
      </div>
    );
  }

  return (
    <div className="py-12">
      <div className="text-center">
        <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
          Simple, transparent pricing
        </h2>
        <p className="mt-4 text-xl text-gray-600">
          Choose the right plan for your needs.
        </p>
      </div>

      {error && (
        <div className="mt-8 max-w-xl mx-auto bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-center">
          {error}
        </div>
      )}

      <div className="mt-16 max-w-7xl mx-auto grid gap-8 lg:grid-cols-3 lg:gap-12">
        {plans.map((plan) => (
          <PlanCard
            key={plan._id}
            plan={plan}
            isCurrentPlan={plan._id === currentPlanId}
            onSelect={handleSelectPlan}
            isLoading={isProcessingId === plan._id}
            disabled={isProcessingId !== null && isProcessingId !== plan._id}
          />
        ))}
      </div>
    </div>
  );
}
