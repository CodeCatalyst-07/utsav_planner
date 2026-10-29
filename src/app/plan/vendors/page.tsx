import * as React from 'react';
import Link from 'next/link';
import { Store, ArrowRight, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function VendorsPage() {
  return (
    <div className="space-y-6">
      <header className="border-b border-surface-border pb-4">
        <div className="inline-flex items-center gap-2 rounded-control border border-surface-border bg-surface px-3 py-1 text-xs font-semibold uppercase tracking-wider text-secondary">
          <CheckSquare className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Curated Checklists</span>
        </div>
        <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight text-ink">
          Vendor Checklist
        </h1>
        <p className="text-ink/75 mt-1 text-base">
          Role-by-role coordinator checklists and vendor lookup via Sample data or Google Places.
        </p>
      </header>

      <section
        aria-labelledby="vendors-empty-heading"
        className="space-y-6 rounded-card border border-surface-border bg-surface p-8 sm:p-10"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-control border border-surface-border bg-bg text-primary">
          <Store className="h-6 w-6" aria-hidden="true" />
        </div>

        <div className="max-w-xl space-y-2">
          <h2 id="vendors-empty-heading" className="font-serif text-2xl font-bold text-ink">
            Vendor Directory arriving in Phase 2
          </h2>
          <p className="text-ink/80 text-base leading-relaxed">
            The `VendorSource` interface (`src/server/vendors/`) will support zero-cost Sample
            vendor data by default, with opt-in Google Places API integration for localized vendor
            searches in Delhi, Mumbai, Bengaluru, and other hubs.
          </p>
        </div>

        <div className="pt-2">
          <Button asChild variant="primary">
            <Link href="/plan/ask" className="gap-2">
              <span>Continue to AI Assistant</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
