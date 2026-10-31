import * as React from 'react';
import { formatInr, inrSpoken } from '@/domain/money/inr';
import { cn } from '@/lib/utils';

interface MoneyDisplayProps {
  amount: number;
  className?: string;
  showSpokenInline?: boolean;
}

/**
 * Accessible currency display for Indian Rupees.
 * - Formats visually using Indian numeric grouping (₹12,34,567).
 * - Exposes spoken format to assistive tech ("rupees 12 lakh 34 thousand 567").
 */
export function MoneyDisplay({ amount, className, showSpokenInline = false }: MoneyDisplayProps) {
  const formatted = formatInr(amount);
  const spoken = inrSpoken(amount);

  if (showSpokenInline) {
    return (
      <span className={cn('tabular-nums', className)}>
        <span className="font-semibold">{formatted}</span>{' '}
        <span className="text-ink/65 text-xs">({spoken})</span>
      </span>
    );
  }

  return (
    <span className={cn('tabular-nums', className)} title={spoken}>
      <span aria-hidden="true">{formatted}</span>
      <span className="sr-only">{spoken}</span>
    </span>
  );
}
