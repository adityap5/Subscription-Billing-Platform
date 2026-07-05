import mongoose, { Schema, Document } from 'mongoose';
import { PaymentStatus, PaymentType } from '../types';

export interface IPayment extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  subscriptionId: mongoose.Types.ObjectId;
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
  amountInPaise: number;
  status: PaymentStatus;
  type: PaymentType;
  /**
   * For upgrade payments: the plan being upgraded TO.
   * Stored at payment creation so the webhook handler knows which plan to apply.
   */
  targetPlanId: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: 'Subscription',
      required: true,
    },
    razorpayOrderId: {
      type: String,
      required: true,
      index: true,
    },
    razorpayPaymentId: {
      type: String,
      default: null,
    },
    amountInPaise: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'amountInPaise must be an integer (no floats in money)',
      },
    },
    status: {
      type: String,
      enum: Object.values(PaymentStatus),
      required: true,
      default: PaymentStatus.CREATED,
    },
    type: {
      type: String,
      enum: Object.values(PaymentType),
      required: true,
    },
    targetPlanId: {
      type: Schema.Types.ObjectId,
      ref: 'Plan',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

paymentSchema.index({ subscriptionId: 1, status: 1 });

export const Payment = mongoose.model<IPayment>('Payment', paymentSchema);
