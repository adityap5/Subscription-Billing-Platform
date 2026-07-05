import { calculateProratedAmount } from '../utils/money';
import { IPlan } from '../models/plan.model';

export interface ProratedResult {
  amountInPaise: number;
  daysRemaining: number;
  totalDays: number;
  currentDailyRate: number;
  newDailyRate: number;
}

/**
 * Proration service — only used for upgrades.
 * Downgrades are scheduled at next billing cycle, never prorated.
 *
 * See ARCHITECTURE.md Decision #3 for formula details.
 */

/**
 * @param currentPlan - The user's current active plan
 * @param newPlan - The plan being upgraded to
 * @param periodStart - Current billing period start date
 * @param periodEnd - Current billing period end date
 * @param now - Current time (injectable for testing)
 * @returns Prorated amount details
 */
export function calculateProration(
  currentPlan: IPlan,
  newPlan: IPlan,
  periodStart: Date,
  periodEnd: Date,
  now: Date = new Date()
): ProratedResult {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  const totalDays = Math.ceil(
    (periodEnd.getTime() - periodStart.getTime()) / MS_PER_DAY
  );
  const daysRemaining = Math.ceil(
    (periodEnd.getTime() - now.getTime()) / MS_PER_DAY
  );

  const currentDailyRate = Math.floor(currentPlan.priceInPaise / totalDays);
  const newDailyRate = Math.floor(newPlan.priceInPaise / totalDays);

  const amountInPaise = calculateProratedAmount(
    currentPlan.priceInPaise,
    newPlan.priceInPaise,
    periodStart,
    periodEnd,
    now
  );

  return {
    amountInPaise,
    daysRemaining,
    totalDays,
    currentDailyRate,
    newDailyRate,
  };
}