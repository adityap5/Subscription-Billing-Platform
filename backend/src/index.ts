import { loadEnv } from './config/env';
import { connectDB } from './config/db';
import { createApp } from './app';
import { logger } from './utils/logger';

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
  });
}

main().catch((error) => {
  logger.error('Failed to start server', {
    error: error instanceof Error ? error.message : 'Unknown error',
  });
  process.exit(1);
});