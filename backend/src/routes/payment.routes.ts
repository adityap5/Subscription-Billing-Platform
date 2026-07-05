import { Router } from 'express';
import * as paymentController from '../controllers/payment.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();


router.use(authMiddleware);
router.get('/', paymentController.getPayments);
router.get('/:id', paymentController.getPayment);

export default router;
