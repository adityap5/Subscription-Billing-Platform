// Converts rupee amount to paise
export function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

// Converts paise to rupees for display purposes
export function fromPaise(paise: number): number {
  return paise / 100;
}

// Formats paise as a human-readable INR string
export function formatPaise(paise: number): string {
  return `₹${fromPaise(paise).toFixed(2)}`;
}

// Safely adds two paise amounts
export function addPaise(a: number, b: number): number {
  return Math.round(a + b);
}

// Safely subtracts paise amounts
export function subtractPaise(a: number, b: number): number {
  return Math.round(a - b);
}

// Validates that a value is a non-negative integer suitable for paise
export function isValidPaise(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

// Calculates a prorated amount for upgrade mid-cycle.
export function calculateProratedAmount(
  currentPriceInPaise: number,
  newPriceInPaise: number,
  periodStart: Date,
  periodEnd: Date,
  now: Date = new Date()
): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  const totalDays = Math.ceil(
    (periodEnd.getTime() - periodStart.getTime()) / MS_PER_DAY
  );
  const daysRemaining = Math.ceil(
    (periodEnd.getTime() - now.getTime()) / MS_PER_DAY
  );

  if (totalDays <= 0 || daysRemaining <= 0) {
    return 0;
  }

  const priceDifference = newPriceInPaise - currentPriceInPaise;
  const proratedAmount = Math.floor((priceDifference * daysRemaining) / totalDays);

  return Math.max(0, proratedAmount);
}