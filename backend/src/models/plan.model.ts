import mongoose, { Schema, Document } from 'mongoose';

export interface IPlan extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  priceInPaise: number;
  billingIntervalDays: number;
  features: string[];
  isActive: boolean;
  createdAt: Date;
}

const planSchema = new Schema<IPlan>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    priceInPaise: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'priceInPaise must be an integer (no floats in money)',
      },
    },
    billingIntervalDays: {
      type: Number,
      required: true,
      min: 1,
    },
    features: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

export const Plan = mongoose.model<IPlan>('Plan', planSchema);
