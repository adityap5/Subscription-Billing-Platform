import { z } from 'zod';
import { logger } from '../utils/logger';

//Zod schema for all required environment variables.
const envSchema = z.object({
  MONGODB_URI: z
    .string()
    .min(1, 'MONGODB_URI is required — get from MongoDB Atlas Dashboard → Connect'),
  JWT_SECRET: z
    .string()
    .min(16, 'JWT_SECRET must be at least 16 characters — use a strong random string'),
  JWT_EXPIRES_IN: z
    .string()
    .default('7d')
    .describe('JWT expiration period, e.g. 7d, 24h'),
  RAZORPAY_KEY_ID: z
    .string()
    .min(1, 'RAZORPAY_KEY_ID is required — get from Razorpay Dashboard → API Keys'),
  RAZORPAY_KEY_SECRET: z
    .string()
    .min(1, 'RAZORPAY_KEY_SECRET is required — get from Razorpay Dashboard → API Keys'),
  RAZORPAY_WEBHOOK_SECRET: z
    .string()
    .min(1, 'RAZORPAY_WEBHOOK_SECRET is required — set when configuring webhook in Razorpay Dashboard'),
  RESEND_API_KEY: z
    .string()
    .min(1, 'RESEND_API_KEY is required — get from https://resend.com/api-keys'),
  RESEND_FROM_EMAIL: z
    .string()
    .email('RESEND_FROM_EMAIL must be a valid email address'),
  FRONTEND_URL: z
    .string()
    .url('FRONTEND_URL must be a valid URL')
    .default('http://localhost:3000'),
  PORT: z
    .string()
    .default('5000')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive()),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env;

// load env
export function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  ✗ ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    logger.error(`Environment validation failed:\n${errors}`);
    process.exit(1);
  }

  _env = result.data;
  return _env;
}

// get env
export function getEnv(): Env {
  if (!_env) {
    throw new Error('Environment not loaded — call loadEnv() at startup before accessing env');
  }
  return _env;
}
