import { Request, Response, NextFunction } from 'express';
import * as subscriptionService from '../services/subscription.service';
import { ApiResponse } from '../types';

//POST /api/subscriptions- Creates a new subscription + Razorpay order
export async function createSubscription(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { planId } = req.body;
    const userId = req.user!.userId;

    const result = await subscriptionService.createSubscription(userId, planId);

    const response: ApiResponse = {
      success: true,
      message: 'Subscription created, proceed to payment',
      data: {
        subscriptionId: result.subscription._id,
        orderId: result.orderId,
        amount: result.amount,
        currency: 'INR',
        keyId: result.keyId,
      },
    };

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
}

//GET /api/subscriptions/current - Gets the user current subscription
export async function getCurrentSubscription(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const subscription =
      await subscriptionService.getCurrentSubscription(userId);

    const response: ApiResponse = {
      success: true,
      message: subscription ? 'Subscription found' : 'No active subscription',
      data: { subscription },
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}

//POST /api/subscriptions/:id/cancel
export async function cancelSubscription(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const subscription = await subscriptionService.cancelSubscription(
      id,
      userId
    );

    const response: ApiResponse = {
      success: true,
      message: 'Subscription will be canceled at the end of the billing period',
      data: { subscription },
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}

//POST /api/subscriptions/:id/change-plan - Handles both upgrades and downgrades
export async function changePlan(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const { newPlanId } = req.body;
    const userId = req.user!.userId;

    const result = await subscriptionService.changePlan(id, newPlanId, userId);

    if (result.type === 'upgrade' && result.orderId) {
      const response: ApiResponse = {
        success: true,
        message: 'Upgrade order created, proceed to payment',
        data: {
          type: 'upgrade',
          subscriptionId: result.subscription._id,
          orderId: result.orderId,
          amount: result.amount,
          currency: 'INR',
          keyId: result.keyId,
        },
      };
      res.status(200).json(response);
    } else if (result.type === 'upgrade') {
      const response: ApiResponse = {
        success: true,
        message: 'Plan upgraded immediately (no proration charge)',
        data: {
          type: 'upgrade',
          subscription: result.subscription,
        },
      };
      res.status(200).json(response);
    } else {
      const response: ApiResponse = {
        success: true,
        message: 'Plan change scheduled for end of current billing period',
        data: {
          type: 'downgrade',
          subscription: result.subscription,
        },
      };
      res.status(200).json(response);
    }
  } catch (error) {
    next(error);
  }
}

//GET /api/subscriptions/invoices
export async function getInvoices(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const invoices = await subscriptionService.getUserInvoices(userId);

    const response: ApiResponse = {
      success: true,
      message: 'Invoices retrieved',
      data: { invoices },
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}