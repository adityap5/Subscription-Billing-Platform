import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { getEnv } from './config/env';
import { errorHandler } from './middleware/errorHandler.middleware';
import authRoutes from './routes/auth.routes';
import planRoutes from './routes/plan.routes';
import subscriptionRoutes from './routes/subscription.routes';
import paymentRoutes from './routes/payment.routes';
import webhookRoutes from './routes/webhook.routes';

export function createApp(): express.Application {
  const app = express();
  const { FRONTEND_URL } = getEnv();

  // Security headers
  app.use(helmet());

  // CORS
  app.use(
    cors({
      origin: FRONTEND_URL,
      credentials: true,
    })
  );

  app.use(
    express.json({
      verify: (req: express.Request, _res, buf) => {
        (req as express.Request).rawBody = buf;
      },
    })
  );

  // Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/plans', planRoutes);
  app.use('/api/subscriptions', subscriptionRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/webhooks', webhookRoutes);

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ success: true, message: 'Server is healthy', timestamp: new Date().toISOString() });
  });

  // Error handler
  app.use(errorHandler);

  return app;
}