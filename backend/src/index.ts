import { loadEnv } from './config/env';
import { connectDB } from './config/db';
import { createApp } from './app';
import { logger } from './utils/logger';
import cron from 'node-cron';
import { processScheduledTransitions } from './services/subscription';
async function main(): Promise<void> {
  const env = loadEnv();
  logger.info('Environment validated');

  await connectDB();

  const app = createApp();
  const port = env.PORT;

  app.listen(port, () => {
    logger.info(`Server started on port ${port}`, {
      port,
      frontendUrl: env.FRONTEND_URL,
      environment: process.env.NODE_ENV || 'development',
    });

    // Schedule background job for subscription transitions (runs every hour)
    cron.schedule('0 * * * *', async () => {
      logger.info('Running scheduled job: processScheduledTransitions');
      try {
        const results = await processScheduledTransitions();
        logger.info('Scheduled job processScheduledTransitions completed', results);
      } catch (error) {
        logger.error('Scheduled job processScheduledTransitions failed', { error });
      }
    });
  });
}

main().catch((error) => {
  logger.error('Failed to start server', {
    error: error instanceof Error ? error.message : 'Unknown error',
  });
  process.exit(1);
});