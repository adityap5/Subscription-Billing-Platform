import { Router } from 'express';
import * as webhookController from '../controllers/webhook.controller';

const router = Router();

router.post('/razorpay', webhookController.handleWebhook);

export default router;