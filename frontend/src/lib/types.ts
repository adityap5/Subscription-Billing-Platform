export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Plan {
  _id: string;
  name: string;
  priceInPaise: number;
  billingIntervalDays: number;
  features: string[];
  isActive: boolean;
}

export type SubscriptionStatus = 'pending' | 'active' | 'canceled' | 'expired';
export type PaymentStatus = 'created' | 'captured' | 'failed';
export type PaymentType = 'new_subscription' | 'renewal' | 'upgrade' | 'downgrade';

export interface Subscription {
  _id: string;
  userId: string;
  planId: Plan | string;
  status: SubscriptionStatus;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  pendingPlanId: Plan | string | null;
  pendingPlanEffectiveAt: string | null;
  createdAt: string;
}

export interface Payment {
  _id: string;
  userId: string;
  subscriptionId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
  amountInPaise: number;
  status: PaymentStatus;
  type: PaymentType;
  createdAt: string;
}

export interface Invoice {
  _id: string;
  userId: string;
  subscriptionId: string;
  paymentId: string;
  amountInPaise: number;
  issuedAt: string;
  description: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: Array<{ field?: string; message: string }>;
}


// Formats paise to display rupees.
export function formatPaise(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`;
}


//Formats a date string for display.
export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
