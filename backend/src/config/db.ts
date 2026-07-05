import mongoose from 'mongoose';
import { getEnv } from './env';
import { logger } from '../utils/logger';

//connect DB
export async function connectDB(): Promise<void> {
  const { MONGODB_URI } = getEnv();

  mongoose.connection.on('connected', () => {
    logger.info('MongoDB connected successfully');
  });

  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB connection error', { error: err.message });
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });

  try {
    await mongoose.connect(MONGODB_URI);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to connect to MongoDB', { error: message });
    process.exit(1);
  }
}

//disconnect DB
export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
  logger.info('MongoDB connection closed');
}
