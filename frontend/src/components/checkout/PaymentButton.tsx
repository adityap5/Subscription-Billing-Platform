'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { RazorpayOptions, RazorpayResponse } from '@/lib/types';

interface PaymentButtonProps {
  orderId: string;
  amount: number;
  keyId: string;
  onSuccess: (response: RazorpayResponse) => void;
  onDismiss?: () => void;
  label?: string;
  className?: string;
}

export function PaymentButton({
  orderId,
  amount,
  keyId,
  onSuccess,
  onDismiss,
  label = 'Pay Now',
  className = '',
}: PaymentButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePayment = () => {
    setIsLoading(true);
    setError(null);

    if (!window.Razorpay) {
      setError('Payment system is loading. Please try again.');
      setIsLoading(false);
      return;
    }

    const options: RazorpayOptions = {
      key: keyId,
      amount,
      currency: 'INR',
      order_id: orderId,
      handler: (response) => {
        setIsLoading(false);
        onSuccess(response);
      },
      modal: {
        ondismiss: () => {
          setIsLoading(false);
          onDismiss?.();
        },
      },
      theme: {
        color: '#4F46E5',
      },
    };

    try {
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      setError('Failed to open payment form. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className={className}>
      <Button
        variant="primary"
        size="lg"
        className="w-full"
        onClick={handlePayment}
        isLoading={isLoading}
      >
        {label}
      </Button>
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
