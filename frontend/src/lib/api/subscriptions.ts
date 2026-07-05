import api from '../axios';
import type { ApiResponse, Subscription, Invoice } from '../types';

interface CreateSubscriptionResponse {
  subscriptionId: string;
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
}

interface ChangePlanUpgradeResponse {
  type: 'upgrade';
  subscriptionId: string;
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
}

interface ChangePlanDowngradeResponse {
  type: 'downgrade';
  subscription: Subscription;
}

type ChangePlanResponse = ChangePlanUpgradeResponse | ChangePlanDowngradeResponse;

export async function createSubscription(
  planId: string
): Promise<CreateSubscriptionResponse> {
  const { data } = await api.post<ApiResponse<CreateSubscriptionResponse>>(
    '/subscriptions',
    { planId }
  );
  return data.data!;
}

export async function getCurrentSubscription(): Promise<Subscription | null> {
  const { data } = await api.get<ApiResponse<{ subscription: Subscription | null }>>(
    '/subscriptions/current'
  );
  return data.data!.subscription;
}

export async function cancelSubscription(
  subscriptionId: string
): Promise<Subscription> {
  const { data } = await api.post<ApiResponse<{ subscription: Subscription }>>(
    `/subscriptions/${subscriptionId}/cancel`
  );
  return data.data!.subscription;
}

export async function changePlan(
  subscriptionId: string,
  newPlanId: string
): Promise<ChangePlanResponse> {
  const { data } = await api.post<ApiResponse<ChangePlanResponse>>(
    `/subscriptions/${subscriptionId}/change-plan`,
    { newPlanId }
  );
  return data.data!;
}

export async function getInvoices(): Promise<Invoice[]> {
  const { data } = await api.get<ApiResponse<{ invoices: Invoice[] }>>(
    '/subscriptions/invoices'
  );
  return data.data!.invoices;
}
