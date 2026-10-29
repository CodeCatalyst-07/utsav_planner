/**
 * Integer rupee utilities for Utsav Planner.
 *
 * Rules:
 * - All monetary values in the domain MUST be non-negative or signed integer rupees.
 * - Zero floating point math leaks into final outputs.
 */

/**
 * Formats an integer amount of rupees into standard Indian numbering grouping.
 * e.g. 1234567 => "₹12,34,567"
 * e.g. -50000 => "-₹50,000"
 */
export function formatInr(n: number): string {
  const isNegative = n < 0;
  const absInt = Math.abs(Math.round(n));

  const str = absInt.toString();
  if (str.length <= 3) {
    return `${isNegative ? '-' : ''}₹${str}`;
  }

  const lastThree = str.slice(-3);
  const remaining = str.slice(0, -3);

  // Group remaining digits by 2s from the right
  const otherGroups = remaining.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  const formatted = `${otherGroups},${lastThree}`;

  return `${isNegative ? '-' : ''}₹${formatted}`;
}

/**
 * Converts integer rupees into accessible spoken words for screen readers.
 * Uses Indian denomination units: crore (1,00,00,000), lakh (1,00,000), thousand (1,000).
 * e.g. 800000 => "rupees 8 lakh"
 * e.g. 25000000 => "rupees 2 crore 50 lakh"
 * e.g. 60000 => "rupees 60 thousand"
 */
export function inrSpoken(n: number): string {
  const isNegative = n < 0;
  let remaining = Math.abs(Math.round(n));

  if (remaining === 0) {
    return 'zero rupees';
  }

  const parts: string[] = [];

  const crores = Math.floor(remaining / 10_000_000);
  if (crores > 0) {
    parts.push(`${crores} crore`);
    remaining %= 10_000_000;
  }

  const lakhs = Math.floor(remaining / 100_000);
  if (lakhs > 0) {
    parts.push(`${lakhs} lakh`);
    remaining %= 100_000;
  }

  const thousands = Math.floor(remaining / 1_000);
  if (thousands > 0) {
    parts.push(`${thousands} thousand`);
    remaining %= 1_000;
  }

  if (remaining > 0) {
    parts.push(`${remaining}`);
  }

  const prefix = isNegative ? 'minus rupees ' : 'rupees ';
  return `${prefix}${parts.join(' ')}`;
}

/**
 * Largest Remainder (Hamilton / Hare-Niemeyer) allocation algorithm.
 * Allocates `total` integer amount across `weights` such that:
 * 1. Every result is an integer >= 0.
 * 2. sum(result) === total EXACTLY.
 * 3. Ties in remainders are broken deterministically by smaller index.
 */
export function allocateLargestRemainder(total: number, weights: readonly number[]): number[] {
  const len = weights.length;
  if (len === 0) {
    return [];
  }

  const totalInt = Math.round(total);
  if (totalInt <= 0) {
    return new Array(len).fill(0);
  }

  const sumWeights = weights.reduce((acc, w) => acc + (w > 0 ? w : 0), 0);
  if (sumWeights <= 0) {
    // If all weights are zero, distribute evenly using largest remainder
    return allocateLargestRemainder(totalInt, new Array(len).fill(1));
  }

  interface Item {
    index: number;
    integerPart: number;
    remainder: number;
  }

  const items: Item[] = weights.map((w, index) => {
    const validW = w > 0 ? w : 0;
    const exact = (totalInt * validW) / sumWeights;
    const integerPart = Math.floor(exact);
    const remainder = exact - integerPart;
    return { index, integerPart, remainder };
  });

  let allocatedSum = items.reduce((sum, item) => sum + item.integerPart, 0);
  let deficit = totalInt - allocatedSum;

  // Sort items descending by remainder; break ties by ascending original index
  items.sort((a, b) => {
    if (b.remainder !== a.remainder) {
      return b.remainder - a.remainder;
    }
    return a.index - b.index;
  });

  // Distribute 1 to the largest remainders
  for (let i = 0; i < deficit; i++) {
    const item = items[i % len];
    if (item) {
      item.integerPart += 1;
    }
  }

  // Restore original order
  items.sort((a, b) => a.index - b.index);

  return items.map((item) => item.integerPart);
}
