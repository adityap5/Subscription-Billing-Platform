import { loadEnv } from '../config/env';
import { connectDB, disconnectDB } from '../config/db';
import { Plan } from '../models/plan.model';
import { logger } from '../utils/logger';

const SEED_PLANS = [
  {
    name: 'Basic',
    priceInPaise: 49900,
    billingIntervalDays: 30,
    features: ['5 projects', 'Basic support', '1 GB storage'],
    isActive: true,
  },
  {
    name: 'Pro',
    priceInPaise: 99900,
    billingIntervalDays: 30,
    features: [
      'Unlimited projects',
      'Priority support',
      '10 GB storage',
      'API access',
    ],
    isActive: true,
  },
  {
    name: 'Enterprise',
    priceInPaise: 199900,
    billingIntervalDays: 30,
    features: [
      'Everything in Pro',
      'Dedicated support',
      '100 GB storage',
      'Custom integrations',
      'SLA guarantee',
    ],
    isActive: true,
  },
];

async function seed(): Promise<void> {
  loadEnv();
  await connectDB();

  logger.info('Starting seed...');

  for (const planData of SEED_PLANS) {
    const existingPlan = await Plan.findOne({ name: planData.name });

    if (existingPlan) {
      logger.info(`Plan "${planData.name}" already exists, skipping`, {
        planId: existingPlan._id.toString(),
        priceInPaise: existingPlan.priceInPaise,
      });
      continue;
    }

    const plan = await Plan.create(planData);
    logger.info(`Plan "${planData.name}" created`, {
      planId: plan._id.toString(),
      priceInPaise: planData.priceInPaise,
    });
  }

  logger.info('Seed complete');
  await disconnectDB();
}

seed().catch((error) => {
  logger.error('Seed failed', {
    error: error instanceof Error ? error.message : 'Unknown error',
  });
  process.exit(1);
});
