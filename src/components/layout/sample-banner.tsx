'use client';

import * as React from 'react';
import Link from 'next/link';
import { Sparkles, ArrowRight, X } from 'lucide-react';
import { usePlan } from '@/context/plan-context';
import { Button } from '@/components/ui/button';

export function SampleBanner() {
  const { isSampleMode, hasRealPlan, exitSample } = usePlan();

  if (!isSampleMode) return null;

  return (
    <aside
      aria-label="Sample Plan Notice"
      className="border-b border-surface-border bg-bg px-4 py-2.5 sm:px-6"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2 text-ink">
          <div className="bg-secondary/15 flex h-6 w-6 items-center justify-center rounded-full text-secondary">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          </div>
          <span className="font-medium">
            You&apos;re viewing a sample plan.{' '}
            <span className="text-ink/75">None of this replaces your saved data.</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {hasRealPlan && (
            <Button
              variant="outline"
              size="sm"
              onClick={exitSample}
              className="h-8 px-2.5 text-xs text-ink"
            >
              Return to my saved plan
            </Button>
          )}

          <Button asChild size="sm" variant="primary" className="h-8 gap-1.5 px-3 text-xs">
            <Link href="/plan/new">
              <span>Start my own plan</span>
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </Button>

          <button
            onClick={exitSample}
            type="button"
            className="touch-target text-ink/60 ml-1 flex h-8 w-8 items-center justify-center rounded-control hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Close sample banner and return"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
