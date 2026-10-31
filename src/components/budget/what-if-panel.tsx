'use client';

import * as React from 'react';
import { Sliders, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatInr, inrSpoken } from '@/domain/money/inr';
import { getTomorrowInIst } from '@/lib/today';
import { ReplanResult } from '@/domain/rules/replan';

export interface WhatIfPanelProps {
  whatIfGuests: number;
  setWhatIfGuests: React.Dispatch<React.SetStateAction<number>>;
  whatIfBudget: number;
  setWhatIfBudget: React.Dispatch<React.SetStateAction<number>>;
  whatIfDate: string;
  setWhatIfDate: React.Dispatch<React.SetStateAction<string>>;
  liveAnnouncement: string;
  replanOutput: ReplanResult | null;
  onApply: () => void;
  onDiscard: () => void;
}

export function WhatIfPanel({
  whatIfGuests,
  setWhatIfGuests,
  whatIfBudget,
  setWhatIfBudget,
  whatIfDate,
  setWhatIfDate,
  liveAnnouncement,
  replanOutput,
  onApply,
  onDiscard,
}: WhatIfPanelProps) {
  return (
    <section
      aria-labelledby="whatif-heading"
      className="border-primary/30 rounded-card border-2 bg-surface p-6 text-left"
    >
      <div className="border-surface-border/60 flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-control bg-primary text-white">
            <Sliders className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h2 id="whatif-heading" className="font-serif text-xl font-bold text-ink">
              What-If Rebalancing Sandbox
            </h2>
            <p className="text-ink/65 text-xs">
              Zero network calls. Test guest counts, dates, and budget shifts locally before
              applying.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDiscard}
            className="gap-1 text-xs"
          >
            <span>Discard</span>
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={onApply}
            className="gap-1 text-xs"
          >
            <span>Apply changes</span>
          </Button>
        </div>
      </div>

      {/* Screen Reader Live Region */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {liveAnnouncement}
      </div>

      {/* What-If Input Controls */}
      <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Guests Input with Stepper */}
        <div className="space-y-2">
          <label
            htmlFor="whatif-guests"
            className="text-xs font-semibold uppercase tracking-wider text-ink"
          >
            Guest Count
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setWhatIfGuests((prev) => Math.max(1, prev - 25))}
              className="touch-target flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-surface-border bg-bg text-ink hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Decrease what-if guests by 25"
            >
              <Minus className="h-4 w-4" />
            </button>

            <Input
              id="whatif-guests"
              type="number"
              min={1}
              max={5000}
              value={whatIfGuests}
              onChange={(e) => setWhatIfGuests(parseInt(e.target.value, 10) || 1)}
              className="text-center font-semibold tabular-nums"
            />

            <button
              type="button"
              onClick={() => setWhatIfGuests((prev) => Math.min(5000, prev + 25))}
              className="touch-target flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-surface-border bg-bg text-ink hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Increase what-if guests by 25"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Budget Input with Stepper (step 50k) */}
        <div className="space-y-2">
          <label
            htmlFor="whatif-budget"
            className="text-xs font-semibold uppercase tracking-wider text-ink"
          >
            Total Budget (₹50,000 Step)
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setWhatIfBudget((prev) => Math.max(10000, prev - 50000))}
              className="touch-target flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-surface-border bg-bg text-ink hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Decrease what-if budget by ₹50,000"
            >
              <Minus className="h-4 w-4" />
            </button>

            <Input
              id="whatif-budget"
              type="number"
              step={50000}
              min={10000}
              value={whatIfBudget}
              onChange={(e) => setWhatIfBudget(parseInt(e.target.value, 10) || 0)}
              className="text-center font-semibold tabular-nums"
            />

            <button
              type="button"
              onClick={() => setWhatIfBudget((prev) => prev + 50000)}
              className="touch-target flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-surface-border bg-bg text-ink hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Increase what-if budget by ₹50,000"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <p className="text-ink/65 text-[11px] tabular-nums">
            {formatInr(whatIfBudget)} ({inrSpoken(whatIfBudget)})
          </p>
        </div>

        {/* Event Date Input */}
        <div className="space-y-2">
          <label
            htmlFor="whatif-date"
            className="text-xs font-semibold uppercase tracking-wider text-ink"
          >
            Event Date
          </label>
          <Input
            id="whatif-date"
            type="date"
            min={getTomorrowInIst()}
            value={whatIfDate}
            onChange={(e) => setWhatIfDate(e.target.value)}
            className="h-10"
          />
        </div>
      </div>

      {/* Live Diff Output */}
      {replanOutput && replanOutput.ok && (
        <div className="border-surface-border/60 mt-6 space-y-3 border-t pt-4">
          <div className="flex items-center justify-between">
            <span className="text-ink/75 text-xs font-semibold uppercase tracking-wider">
              Computed Rebalance Diffs
            </span>
            <span className="text-xs font-semibold text-secondary">
              Calculated locally via pure TypeScript
            </span>
          </div>

          {/* Diff Chips */}
          <div className="flex flex-wrap gap-2">
            {replanOutput.diff.cateringEstimateDelta !== 0 && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium tabular-nums ${
                  replanOutput.diff.cateringEstimateDelta > 0
                    ? 'border-warning/30 bg-warning/15 border text-warning'
                    : 'border-secondary/30 bg-secondary/15 border text-secondary'
                }`}
              >
                <span>
                  Catering {replanOutput.diff.cateringEstimateDelta > 0 ? '+' : ''}
                  {formatInr(replanOutput.diff.cateringEstimateDelta)}
                </span>
              </span>
            )}

            {replanOutput.diff.totalDelta !== 0 && (
              <span className="border-primary/30 bg-primary/10 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium tabular-nums text-primary">
                <span>
                  Total Budget {replanOutput.diff.totalDelta > 0 ? '+' : ''}
                  {formatInr(replanOutput.diff.totalDelta)}
                </span>
              </span>
            )}

            {replanOutput.diff.milestonesShifted.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-surface-border bg-bg px-3 py-1 text-xs font-medium text-ink">
                <span>
                  {replanOutput.diff.milestonesShifted.length} milestone
                  {replanOutput.diff.milestonesShifted.length > 1 ? 's' : ''} shifted
                </span>
              </span>
            )}

            {replanOutput.diff.flagsAdded.length > 0 && (
              <span className="border-danger/30 bg-danger/10 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium text-danger">
                <span>New heads-up: catering over</span>
              </span>
            )}
          </div>

          {/* diff.summaryFacts */}
          {replanOutput.diff.summaryFacts.length > 0 && (
            <div className="bg-bg/60 rounded-control p-3 text-xs">
              <p className="font-semibold text-ink">Engine Replan Summary:</p>
              <ul className="text-ink/80 mt-1 list-inside list-disc space-y-0.5">
                {replanOutput.diff.summaryFacts.map((fact, idx) => (
                  <li key={idx}>{fact}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
