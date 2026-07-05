import { describe, test, expect } from 'bun:test';
import { calculateProratedAmount } from '../src/utils/money';
import { calculateProration } from '../src/services/proration.service';

/**
 * Proration calculation tests.
 * Verifies the upgrade proration formula produces correct results.
 * Only used for upgrades — downgrades are scheduled, never prorated.
 */

describe('Proration Calculations', () => {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  describe('calculateProratedAmount', () => {
    test('should compute correct prorated amount for upgrade', () => {
      const periodStart = new Date('2025-01-01');
      const periodEnd = new Date('2025-01-31'); // 30 days
      const now = new Date('2025-01-16'); // 15 days remaining

      // Upgrading from ₹499 (49900 paise) to ₹999 (99900 paise)
      const result = calculateProratedAmount(
        49900, // current price
        99900, // new price
        periodStart,
        periodEnd,
        now
      );

      // Price diff = 50000 paise
      // Days remaining = 15, total days = 30
      // Prorated = floor(50000 * 15 / 30) = floor(25000) = 25000
      expect(result).toBe(25000);
    });

    test('should return 0 when period has ended (0 days remaining)', () => {
      const periodStart = new Date('2025-01-01');
      const periodEnd = new Date('2025-01-31');
      const now = new Date('2025-02-01'); // Past period end

      const result = calculateProratedAmount(
        49900,
        99900,
        periodStart,
        periodEnd,
        now
      );

      expect(result).toBe(0);
    });

    test('should return full difference on first day of cycle', () => {
      const periodStart = new Date('2025-01-01');
      const periodEnd = new Date('2025-01-31'); // 30 days
      const now = new Date('2025-01-01'); // 30 days remaining

      const result = calculateProratedAmount(
        49900,
        99900,
        periodStart,
        periodEnd,
        now
      );

      // Price diff = 50000, 30/30 days remaining
      // floor(50000 * 30 / 30) = 50000
      expect(result).toBe(50000);
    });

    test('should handle last day of cycle', () => {
      const periodStart = new Date('2025-01-01');
      const periodEnd = new Date('2025-01-31'); // 30 days
      const now = new Date('2025-01-30'); // 1 day remaining

      const result = calculateProratedAmount(
        49900,
        99900,
        periodStart,
        periodEnd,
        now
      );

      // Price diff = 50000, 1/30 days remaining
      // floor(50000 * 1 / 30) = floor(1666.67) = 1666
      expect(result).toBe(1666);
    });

    test('should return 0 for same price plans', () => {
      const periodStart = new Date('2025-01-01');
      const periodEnd = new Date('2025-01-31');
      const now = new Date('2025-01-15');

      const result = calculateProratedAmount(
        99900,
        99900,
        periodStart,
        periodEnd,
        now
      );

      expect(result).toBe(0);
    });

    test('should return 0 for downgrade (negative difference)', () => {
      const periodStart = new Date('2025-01-01');
      const periodEnd = new Date('2025-01-31');
      const now = new Date('2025-01-15');

      // "Downgrading" — but caller should never call this for downgrades
      const result = calculateProratedAmount(
        99900,
        49900,
        periodStart,
        periodEnd,
        now
      );

      // Max(0, negative) = 0
      expect(result).toBe(0);
    });

    test('should round down (favor customer)', () => {
      const periodStart = new Date('2025-01-01');
      const periodEnd = new Date('2025-01-31'); // 30 days
      const now = new Date('2025-01-21'); // 10 days remaining

      // Upgrading from ₹499 to ₹999 with 10/30 days remaining
      const result = calculateProratedAmount(
        49900,
        99900,
        periodStart,
        periodEnd,
        now
      );

      // floor(50000 * 10 / 30) = floor(16666.67) = 16666
      expect(result).toBe(16666);
    });

    test('should use integer arithmetic (no floats)', () => {
      const periodStart = new Date('2025-01-01');
      const periodEnd = new Date('2025-01-31');
      const now = new Date('2025-01-20');

      const result = calculateProratedAmount(
        33300, // ₹333 — odd number
        77700, // ₹777 — odd number
        periodStart,
        periodEnd,
        now
      );

      // Result should always be an integer
      expect(Number.isInteger(result)).toBe(true);
      expect(result).toBeGreaterThanOrEqual(0);
    });
  });

  describe('calculateProration service', () => {
    test('should return structured proration result', () => {
      const periodStart = new Date('2025-01-01');
      const periodEnd = new Date('2025-01-31');
      const now = new Date('2025-01-16');

      const currentPlan = {
        priceInPaise: 49900,
      } as any;

      const newPlan = {
        priceInPaise: 99900,
      } as any;

      const result = calculateProration(
        currentPlan,
        newPlan,
        periodStart,
        periodEnd,
        now
      );

      expect(result.amountInPaise).toBe(25000);
      expect(result.daysRemaining).toBe(15);
      expect(result.totalDays).toBe(30);
      expect(Number.isInteger(result.currentDailyRate)).toBe(true);
      expect(Number.isInteger(result.newDailyRate)).toBe(true);
    });
  });
});
