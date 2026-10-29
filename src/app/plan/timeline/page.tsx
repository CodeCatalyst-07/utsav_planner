import * as React from 'react';
import Link from 'next/link';
import { Clock, ArrowRight, CalendarRange } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function TimelinePage() {
  return (
    <div className="space-y-6">
      <header className="border-b border-surface-border pb-4">
        <div className="inline-flex items-center gap-2 rounded-control border border-surface-border bg-surface px-3 py-1 text-xs font-semibold uppercase tracking-wider text-secondary">
          <CalendarRange className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Muhurat & Lead Times</span>
        </div>
        <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight text-ink">
          Timeline & Milestones
        </h1>
        <p className="text-ink/75 mt-1 text-base">
          Backward-scheduled milestone tracking aligned with Indian event lead times.
        </p>
      </header>

      <section
        aria-labelledby="timeline-empty-heading"
        className="space-y-6 rounded-card border border-surface-border bg-surface p-8 sm:p-10"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-control border border-surface-border bg-bg text-primary">
          <Clock className="h-6 w-6" aria-hidden="true" />
        </div>

        <div className="max-w-xl space-y-2">
          <h2 id="timeline-empty-heading" className="font-serif text-2xl font-bold text-ink">
            Milestone Engine arriving in Phase 2
          </h2>
          <p className="text-ink/80 text-base leading-relaxed">
            The timeline engine in `src/domain/rules/timeline.ts` will compute target booking dates
            for venues (6-12 months), outfits/tailoring (3-4 months), invitations (2 months), and
            pandit/muhurat consultations.
          </p>
        </div>

        <div className="pt-2">
          <Button asChild variant="primary">
            <Link href="/plan/vendors" className="gap-2">
              <span>Continue to Vendors</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
