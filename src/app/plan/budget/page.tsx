import * as React from 'react';
import Link from 'next/link';
import { IndianRupee, ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function BudgetPage() {
  return (
    <div className="space-y-6">
      <header className="border-b border-surface-border pb-4">
        <div className="inline-flex items-center gap-2 rounded-control border border-surface-border bg-surface px-3 py-1 text-xs font-semibold uppercase tracking-wider text-secondary">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Deterministic Splits</span>
        </div>
        <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight text-ink">
          Budget Allocation
        </h1>
        <p className="text-ink/75 mt-1 text-base">
          Deterministic cost bands based on city tier (Tier 1/2/3) and guest count.
        </p>
      </header>

      <section
        aria-labelledby="budget-empty-heading"
        className="space-y-6 rounded-card border border-surface-border bg-surface p-8 sm:p-10"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-control border border-surface-border bg-bg text-primary">
          <IndianRupee className="h-6 w-6" aria-hidden="true" />
        </div>

        <div className="max-w-xl space-y-2">
          <h2 id="budget-empty-heading" className="font-serif text-2xl font-bold text-ink">
            Budget Engine arriving in Phase 2
          </h2>
          <p className="text-ink/80 text-base leading-relaxed">
            The mathematical allocation engine in `src/domain/rules/budget.ts` will calculate
            percentage splits for venue, catering, decor, photography, gifts, and rituals with zero
            hallucinations.
          </p>
        </div>

        <div className="pt-2">
          <Button asChild variant="primary">
            <Link href="/plan/timeline" className="gap-2">
              <span>Continue to Timeline</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
