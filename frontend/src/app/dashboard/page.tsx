'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import * as subscriptionApi from '@/lib/api/subscriptions';
import type { Subscription, Invoice } from '@/lib/types';
import { SubscriptionStatusCard } from '@/components/dashboard/SubscriptionStatusCard';
import { InvoiceTable } from '@/components/dashboard/InvoiceTable';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

export default function DashboardPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  const loadData = async () => {
    if (!isAuthenticated) return;
    try {
      setIsLoading(true);
      const [subData, invData] = await Promise.all([
        subscriptionApi.getCurrentSubscription(),
        subscriptionApi.getInvoices(),
      ]);
      setSubscription(subData);
      setInvoices(invData);
    } catch (err: any) {
      setError('Failed to load dashboard data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [isAuthenticated]);

  const handleCancel = async () => {
    if (!subscription) return;
    if (!confirm('Are you sure you want to cancel your subscription?')) return;
    
    try {
      setIsCancelling(true);
      await subscriptionApi.cancelSubscription(subscription._id);
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to cancel subscription');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleChangePlan = () => {
    router.push('/pricing');
  };

  if (authLoading || (isAuthenticated && isLoading)) {
    return <div className="py-20"><Spinner /></div>;
  }

  if (!isAuthenticated) return null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Welcome back, {user?.name}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-8">
          {subscription ? (
            <SubscriptionStatusCard
              subscription={subscription}
              onCancel={handleCancel}
              onChangePlan={handleChangePlan}
              isCancelling={isCancelling}
            />
          ) : (
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm text-center">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                No Active Subscription
              </h2>
              <p className="text-gray-500 mb-6 text-sm">
                You don't have an active subscription yet. Choose a plan to get started.
              </p>
              <Link href="/pricing">
                <Button className="w-full">View Plans</Button>
              </Link>
            </div>
          )}
        </div>
        
        <div className="lg:col-span-2">
          <InvoiceTable invoices={invoices} />
        </div>
      </div>
    </div>
  );
}
