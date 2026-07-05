import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service';
import { ApiResponse } from '../types';

//POST /api/auth/register
export async function register(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email, password, name } = req.body;
    const { user, token } = await authService.register(email, password, name);

    const response: ApiResponse = {
      success: true,
      message: 'Registration successful',
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
        },
        token,
      },
    };

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
}

//POST /api/auth/login
export async function login(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email, password } = req.body;
    const { user, token } = await authService.login(email, password);

    const response: ApiResponse = {
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
        },
        token,
      },
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}

//GET /api/auth/me
export async function getMe(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await authService.getUserById(req.user!.userId);

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    const response: ApiResponse = {
      success: true,
      message: 'User retrieved',
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
        },
      },
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}
