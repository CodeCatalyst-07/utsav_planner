'use client';

import * as React from 'react';
import Link from 'next/link';
import { CalendarDays, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SampleProfileKind } from '@/domain/fixtures/profiles';

interface PlanEmptyStateProps {
  onLoadSample: (kind: SampleProfileKind) => void;
}

export function PlanEmptyState({ onLoadSample }: PlanEmptyStateProps) {
  return (
    <div className="w-full space-y-6 text-left">
      <header className="border-b border-surface-border pb-4">
        <h1 className="font-serif text-3xl font-bold tracking-tight text-ink">
          Celebration Workspace
        </h1>
        <p className="text-ink/75 mt-1 text-sm sm:text-base">
          Configure your celebration parameters to calculate budgets, timelines, and checklists.
        </p>
      </header>

      <section
        aria-labelledby="empty-plan-heading"
        className="space-y-6 rounded-card border border-surface-border bg-surface p-8 sm:p-12"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-control bg-bg text-primary">
          <CalendarDays className="h-6 w-6" aria-hidden="true" />
        </div>

        <div className="max-w-xl space-y-2">
          <h2 id="empty-plan-heading" className="font-serif text-2xl font-bold text-ink">
            No celebration blueprint configured yet
          </h2>
          <p className="text-ink/80 text-sm leading-relaxed sm:text-base">
            Start with your event details to generate an honest budget breakdown, milestone
            schedules, and personalized celebration ideas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 pt-2">
          <Button asChild size="lg" variant="primary">
            <Link href="/plan/new" className="gap-2">
              <span>Start Planning</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>

          <Button
            type="button"
            size="lg"
            variant="outline"
            onClick={() => onLoadSample('wedding')}
            className="gap-2"
          >
            <span>Try a sample plan</span>
            <Sparkles className="h-4 w-4 text-secondary" aria-hidden="true" />
          </Button>
        </div>
      </section>
    </div>
  );
}

export function PlanSkeleton() {
  return (
    <div className="w-full space-y-6" aria-busy="true">
      <div className="bg-surface-border/40 h-20 w-3/4 animate-pulse rounded-card" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-surface-border/30 h-24 animate-pulse rounded-card" />
        ))}
      </div>
      <div className="bg-surface-border/20 h-64 animate-pulse rounded-card" />
    </div>
  );
}
