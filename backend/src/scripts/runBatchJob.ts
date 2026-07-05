import { connectDB, disconnectDB } from '../config/db';
import { loadEnv } from '../config/env';
import { processScheduledTransitions } from '../services/subscription';
import { logger } from '../utils/logger';

async function runBatchJob() {
  try {
    loadEnv();
    logger.info('Starting manual batch job for subscription transitions...');
    await connectDB();
    
    const results = await processScheduledTransitions();
    
    logger.info('Batch job completed successfully.', results);
    process.exit(0);
  } catch (error) {
    logger.error('Error running batch job:', { error });
    process.exit(1);
  } finally {
    await disconnectDB();
  }
}

runBatchJob();
