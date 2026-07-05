import mongoose, { Schema, Document } from 'mongoose';

export interface IInvoice extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  subscriptionId: mongoose.Types.ObjectId;
  paymentId: mongoose.Types.ObjectId;
  amountInPaise: number;
  issuedAt: Date;
  description: string;
}

const invoiceSchema = new Schema<IInvoice>(
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
    paymentId: {
      type: Schema.Types.ObjectId,
      ref: 'Payment',
      required: true,
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
    issuedAt: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
    description: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: false,
  }
);

invoiceSchema.index({ userId: 1 });
invoiceSchema.index({ subscriptionId: 1 });

export const Invoice = mongoose.model<IInvoice>('Invoice', invoiceSchema);
