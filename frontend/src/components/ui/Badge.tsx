import React from 'react';

interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  children: React.ReactNode;
  className?: string;
}

export function Badge({
  variant = 'default',
  children,
  className = '',
}: BadgeProps) {
  const variantClasses = {
    default: 'bg-gray-100 text-gray-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    danger: 'bg-red-100 text-red-800',
    info: 'bg-blue-100 text-blue-800',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

export function getStatusBadgeVariant(
  status: string
): 'success' | 'warning' | 'danger' | 'info' | 'default' {
  switch (status) {
    case 'active':
    case 'captured':
      return 'success';
    case 'pending':
    case 'created':
      return 'warning';
    case 'canceled':
    case 'failed':
      return 'danger';
    case 'expired':
      return 'info';
    default:
      return 'default';
  }
}
