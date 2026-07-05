import { Types } from 'mongoose';

export interface JwtPayload {
  userId: string;
  email: string;
}

// Augmented Express Request with authenticated user info
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      rawBody?: Buffer;
    }
  }
}

// Subscription status enum
export enum SubscriptionStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  CANCELED = 'canceled',
  EXPIRED = 'expired',
}

// Payment status enum
export enum PaymentStatus {
  CREATED = 'created',
  CAPTURED = 'captured',
  FAILED = 'failed',
}

// Payment type enum
export enum PaymentType {
  NEW_SUBSCRIPTION = 'new_subscription',
  RENEWAL = 'renewal',
  UPGRADE = 'upgrade',
  DOWNGRADE = 'downgrade',
}

// API response envelope
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: Array<{ field?: string; message: string }>;
}