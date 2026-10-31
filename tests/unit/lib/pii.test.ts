import { describe, it, expect } from 'vitest';
import { containsPii, redactPii } from '@/lib/pii';

describe('PII Detection & Redaction (src/lib/pii.ts)', () => {
  it('detects and redacts standard email addresses', () => {
    const text = 'Reach me at organizer@utsav.in or contact.team@celebration.co.uk';
    expect(containsPii(text)).toBe(true);
    expect(redactPii(text)).toBe('Reach me at [removed] or [removed]');
  });

  it('detects and redacts Indian phone numbers across standard formats', () => {
    const numbers = [
      '9876543210',
      '+91 98765 43210',
      '+91-98765-43210',
      '+919876543210',
      '98765 43210',
    ];

    for (const num of numbers) {
      const text = `Call ${num} for details`;
      expect(containsPii(text)).toBe(true);
      expect(redactPii(text)).toBe('Call [removed] for details');
    }
  });

  it('does not falsely flag benign numbers like guest count or currency amounts', () => {
    const benign = 'Budget is ₹25,00,000 for 250 guests with 50 kids and 10 Jain guests.';
    expect(containsPii(benign)).toBe(false);
    expect(redactPii(benign)).toBe(benign);
  });

  it('handles empty and null values safely', () => {
    expect(containsPii('')).toBe(false);
    expect(containsPii(null)).toBe(false);
    expect(containsPii(undefined)).toBe(false);
    expect(redactPii('')).toBe('');
  });
});
