'use client';

import * as React from 'react';
import { StatusChip } from '@/components/ui/status-chip';
import { MoneyDisplay } from '@/components/ui/money-display';
import { formatInr } from '@/domain/money/inr';

export interface CateringEstimate {
  status: 'ok' | 'tight' | 'over';
  low: number;
  mid: number;
  high: number;
  suggestions?: {
    maxGuestsForAllocation: number;
    savingsNeeded: number;
    alternativeTier?: string;
  };
}

export interface CateringCardProps {
  catering: CateringEstimate;
  guestCount: number;
  cityTier: string;
}

export function CateringCard({ catering, guestCount, cityTier }: CateringCardProps) {
  return (
    <section
      aria-labelledby="catering-card-heading"
      className="rounded-card border border-surface-border bg-surface p-6 text-left"
    >
      <div className="border-surface-border/60 flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <div className="flex items-center gap-2">
          <h2 id="catering-card-heading" className="font-serif text-lg font-bold text-ink">
            Catering Feasibility Analysis
          </h2>
          <StatusChip
            status={catering.status}
            customLabel={
              catering.status === 'ok'
                ? 'Adequate Budget'
                : catering.status === 'tight'
                  ? 'Tight Per-Plate'
                  : 'Over Catering Band'
            }
          />
        </div>
        <span className="text-ink/65 text-xs tabular-nums">
          {guestCount} guests • {cityTier.toUpperCase()}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="bg-bg/50 rounded-control p-3">
          <p className="text-ink/65 text-xs">Low Per-Plate Range</p>
          <div className="mt-1 font-bold text-ink">
            <MoneyDisplay amount={catering.low} />
          </div>
        </div>

        <div className="bg-bg/50 rounded-control p-3">
          <p className="text-ink/65 text-xs">Mid Per-Plate Range</p>
          <div className="mt-1 font-bold text-ink">
            <MoneyDisplay amount={catering.mid} />
          </div>
        </div>

        <div className="bg-bg/50 rounded-control p-3">
          <p className="text-ink/65 text-xs">High Per-Plate Range</p>
          <div className="mt-1 font-bold text-ink">
            <MoneyDisplay amount={catering.high} />
          </div>
        </div>
      </div>

      {catering.suggestions && (
        <div className="border-surface-border/60 mt-4 border-t pt-3">
          <p className="text-xs font-semibold text-ink">Engine Recommendations:</p>
          <ul className="text-ink/80 mt-1.5 list-inside list-disc space-y-1 text-xs">
            <li>
              Maximum guest capacity for current catering allocation:{' '}
              {catering.suggestions.maxGuestsForAllocation} guests.
            </li>
            {catering.suggestions.savingsNeeded > 0 && (
              <li>
                Additional allocation needed to reach mid-tier benchmark:{' '}
                {formatInr(catering.suggestions.savingsNeeded)}.
              </li>
            )}
            {catering.suggestions.alternativeTier && (
              <li>
                Recommended alternative tier: {catering.suggestions.alternativeTier.toUpperCase()}.
              </li>
            )}
          </ul>
        </div>
      )}
    </section>
  );
}
