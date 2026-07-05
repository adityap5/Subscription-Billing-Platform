import { z } from 'zod';

export const createSubscriptionSchema = z.object({
  planId: z
    .string()
    .min(1, 'Plan ID is required')
    .regex(/^[a-f\d]{24}$/i, 'Invalid Plan ID format'),
});

export const cancelSubscriptionParamsSchema = z.object({
  id: z
    .string()
    .regex(/^[a-f\d]{24}$/i, 'Invalid Subscription ID format'),
});

export const changePlanSchema = z.object({
  newPlanId: z
    .string()
    .min(1, 'New Plan ID is required')
    .regex(/^[a-f\d]{24}$/i, 'Invalid Plan ID format'),
});

export const changePlanParamsSchema = z.object({
  id: z
    .string()
    .regex(/^[a-f\d]{24}$/i, 'Invalid Subscription ID format'),
});

// Zod schema for validating the shape of a Razorpay webhook payload
export const webhookPayloadSchema = z.object({
  event: z.string().min(1, 'Event type is required'),
  payload: z.object({
    payment: z.object({
      entity: z.object({
        id: z.string().min(1, 'Payment ID is required'),
        order_id: z.string().min(1, 'Order ID is required'),
        amount: z.number(),
        status: z.string(),
      }),
    }),
  }),
});

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;
export type ChangePlanInput = z.infer<typeof changePlanSchema>;
export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;
