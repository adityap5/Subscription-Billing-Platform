import mongoose, { Schema, Document } from 'mongoose';

export interface IWebhookEvent extends Document {
  _id: mongoose.Types.ObjectId;
  razorpayEventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  processedAt: Date;
}

const webhookEventSchema = new Schema<IWebhookEvent>(
  {
    razorpayEventId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
    },
    payload: {
      type: Schema.Types.Mixed,
      required: true,
    },
    processedAt: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
  },
  {
    timestamps: false,
  }
);

export const WebhookEvent = mongoose.model<IWebhookEvent>(
  'WebhookEvent',
  webhookEventSchema
);
