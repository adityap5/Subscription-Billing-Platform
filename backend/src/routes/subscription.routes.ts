import { Router } from 'express';
import * as subscriptionController from '../controllers/subscription.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validateRequest.middleware';
import {
  createSubscriptionSchema,
  cancelSubscriptionParamsSchema,
  changePlanSchema,
  changePlanParamsSchema,
} from '../validators/subscription.validator';

const router = Router();

router.use(authMiddleware);

router.post(
  '/',
  validateRequest(createSubscriptionSchema),
  subscriptionController.createSubscription
);

router.get('/current', subscriptionController.getCurrentSubscription);

router.get('/invoices', subscriptionController.getInvoices);

router.post(
  '/:id/cancel',
  validateRequest(cancelSubscriptionParamsSchema, 'params'),
  subscriptionController.cancelSubscription
);

router.post(
  '/:id/change-plan',
  validateRequest(changePlanParamsSchema, 'params'),
  validateRequest(changePlanSchema),
  subscriptionController.changePlan
);

export default router;