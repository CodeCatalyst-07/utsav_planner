'use client';

import * as React from 'react';
import Link from 'next/link';
import { Store, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SampleProfileKind } from '@/domain/fixtures/profiles';

interface VendorsEmptyStateProps {
  onLoadSample: (kind: SampleProfileKind) => void;
}

export function VendorsEmptyState({ onLoadSample }: VendorsEmptyStateProps) {
  return (
    <div className="w-full space-y-6 text-left">
      <header className="border-b border-surface-border pb-4">
        <div className="inline-flex items-center gap-2 rounded-control border border-surface-border bg-surface px-3 py-1 text-xs font-semibold uppercase tracking-wider text-secondary">
          <Store className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Curated Checklists</span>
        </div>
        <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight text-ink">
          Vendor Checklist
        </h1>
        <p className="text-ink/75 mt-1 text-sm sm:text-base">
          Role-by-role coordinator checklists and vendor lookup via Sample data or Google Maps.
        </p>
      </header>

      <section
        aria-labelledby="vendors-empty-heading"
        className="space-y-6 rounded-card border border-surface-border bg-surface p-8 sm:p-12"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-control bg-bg text-primary">
          <Store className="h-6 w-6" aria-hidden="true" />
        </div>

        <div className="max-w-xl space-y-2">
          <h2 id="vendors-empty-heading" className="font-serif text-2xl font-bold text-ink">
            No vendor checklist configured yet
          </h2>
          <p className="text-ink/80 text-sm leading-relaxed sm:text-base">
            Set up your celebration details to generate prioritized vendor checklists, booking lead
            times, and sample directory listings.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 pt-2">
          <Button asChild size="lg" variant="primary">
            <Link href="/plan/new" className="gap-2">
              <span>Configure Celebration</span>
              <ArrowRight className="h-4 w-4" />
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
            <Sparkles className="h-4 w-4 text-secondary" />
          </Button>
        </div>
      </section>
    </div>
  );
}
