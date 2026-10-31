'use client';

import * as React from 'react';
import Link from 'next/link';
import { Clock, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SampleProfileKind } from '@/domain/fixtures/profiles';

interface TimelineEmptyStateProps {
  onLoadSample: (kind: SampleProfileKind) => void;
}

export function TimelineEmptyState({ onLoadSample }: TimelineEmptyStateProps) {
  return (
    <div className="w-full space-y-6 text-left">
      <header className="border-b border-surface-border pb-4">
        <h1 className="font-serif text-3xl font-bold tracking-tight text-ink">
          Celebration Timeline
        </h1>
        <p className="text-ink/75 mt-1 text-sm sm:text-base">
          Configure your celebration parameters to calculate backward-scheduled milestone dates.
        </p>
      </header>

      <section
        aria-labelledby="empty-timeline-heading"
        className="space-y-6 rounded-card border border-surface-border bg-surface p-8 sm:p-12"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-control bg-bg text-primary">
          <Clock className="h-6 w-6" aria-hidden="true" />
        </div>

        <div className="max-w-xl space-y-2">
          <h2 id="empty-timeline-heading" className="font-serif text-2xl font-bold text-ink">
            No milestones scheduled yet
          </h2>
          <p className="text-ink/80 text-sm leading-relaxed sm:text-base">
            Set up your celebration date, guest tier, and city to receive a deterministic,
            muhurat-aligned planning schedule.
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

export function TimelineSkeleton() {
  return (
    <div className="w-full space-y-6 text-left" aria-busy="true">
      <div className="bg-surface-border/50 h-8 w-64 animate-pulse rounded" />
      <div className="bg-surface-border/30 h-4 w-96 animate-pulse rounded" />
      <div className="space-y-4 pt-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-card bg-surface p-4" />
        ))}
      </div>
    </div>
  );
}
