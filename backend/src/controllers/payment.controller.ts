import { Request, Response, NextFunction } from 'express';
import { Payment } from '../models/payment.model';
import { ApiResponse } from '../types';

//GET /api/payments
export async function getPayments(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const payments = await Payment.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    const response: ApiResponse = {
      success: true,
      message: 'Payments retrieved',
      data: { payments },
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}

//GET /api/payments/:id
export async function getPayment(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const payment = await Payment.findOne({ _id: id, userId }).lean();

    if (!payment) {
      res.status(404).json({
        success: false,
        message: 'Payment not found',
      });
      return;
    }

    const response: ApiResponse = {
      success: true,
      message: 'Payment retrieved',
      data: { payment },
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}
