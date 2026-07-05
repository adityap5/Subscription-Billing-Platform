import { Request, Response, NextFunction } from 'express';
import { Plan } from '../models/plan.model';
import { ApiResponse } from '../types';

//GET /api/plans
export async function getPlans(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const plans = await Plan.find({ isActive: true }).sort({ priceInPaise: 1 });

    const response: ApiResponse = {
      success: true,
      message: 'Plans retrieved',
      data: { plans },
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}
