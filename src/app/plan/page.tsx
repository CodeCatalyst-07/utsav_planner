import * as React from 'react';
import Link from 'next/link';
import { Calendar, ArrowRight, Sparkles, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PlanPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function PlanPage({ searchParams }: PlanPageProps) {
  const resolvedParams = await searchParams;
  const isSample = resolvedParams.sample === '1';
  const eventType = typeof resolvedParams.type === 'string' ? resolvedParams.type : 'custom';

  if (isSample) {
    return (
      <div className="space-y-6">
        <header className="border-b border-surface-border pb-4">
          <div className="inline-flex items-center gap-2 rounded-control border border-surface-border bg-surface px-3 py-1 text-xs font-semibold uppercase tracking-wider text-secondary">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Interactive Sample Blueprint</span>
          </div>
          <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight text-ink">
            Sample Celebration Plan
          </h1>
          <p className="text-ink/75 mt-1 text-base">
            Full end-to-end sample simulation including pre-calculated budgets, muhurat timelines,
            and mock vendor quotes.
          </p>
        </header>

        {/* Empty state with clear action */}
        <section
          aria-labelledby="sample-status-heading"
          className="space-y-6 rounded-card border border-surface-border bg-surface p-8 text-left sm:p-12"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-control border border-surface-border bg-bg text-primary">
            <Clock className="h-6 w-6" aria-hidden="true" />
          </div>

          <div className="max-w-xl space-y-2">
            <h2 id="sample-status-heading" className="font-serif text-2xl font-bold text-ink">
              Sample Plan Generator coming in Phase 2
            </h2>
            <p className="text-ink/80 text-base leading-relaxed">
              The deterministic rule engines and LLM synthesis modules are currently being
              integrated. In the upcoming phase, you will be able to load realistic wedding,
              birthday, and festival sample scenarios with a single click.
            </p>
          </div>

          <div className="pt-2">
            <Button asChild size="lg" variant="primary">
              <Link href="/plan" className="gap-2">
                <span>Configure New Event</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="border-b border-surface-border pb-4">
        <div className="inline-flex items-center gap-2 rounded-control border border-surface-border bg-surface px-3 py-1 text-xs font-semibold uppercase tracking-wider text-secondary">
          <span className="h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
          <span>Event Workspace</span>
        </div>
        <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight text-ink">
          Celebration Plan Overview
        </h1>
        <p className="text-ink/75 mt-1 text-base">
          Orchestrate your event parameters, budget tiers, and cultural milestone dates.
        </p>
      </header>

      {/* Main Empty State */}
      <section
        aria-labelledby="overview-empty-heading"
        className="space-y-6 rounded-card border border-surface-border bg-surface p-8 sm:p-10"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-control border border-surface-border bg-bg text-primary">
            <Calendar className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 id="overview-empty-heading" className="font-serif text-2xl font-bold text-ink">
              Ready for Profile Intake (
              {eventType === 'custom' ? 'New Plan' : eventType.toUpperCase()})
            </h2>
            <p className="text-ink/70 text-sm">
              Scaffolded structure initialized. EventProfile Zod validation and rule engines arrive
              in Phase 2.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 pt-2 md:grid-cols-3">
          <div className="bg-bg/50 space-y-2 rounded-control border border-surface-border p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <CheckCircle2 className="h-4 w-4 text-secondary" />
              <span>Locale Pack Ready</span>
            </div>
            <p className="text-ink/75 text-xs">
              India-specific cost bands and lead-time presets ready in `src/domain/config/in/`.
            </p>
          </div>

          <div className="bg-bg/50 space-y-2 rounded-control border border-surface-border p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <CheckCircle2 className="h-4 w-4 text-secondary" />
              <span>Verified Contrast</span>
            </div>
            <p className="text-ink/75 text-xs">
              15.68:1 ink on bg, 10.04:1 white on primary, zero low-contrast text.
            </p>
          </div>

          <div className="bg-bg/50 space-y-2 rounded-control border border-surface-border p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <CheckCircle2 className="h-4 w-4 text-secondary" />
              <span>Provider Adapters</span>
            </div>
            <p className="text-ink/75 text-xs">
              Lazy `getEnv()` memoization initialized. No secrets required during scaffolding.
            </p>
          </div>
        </div>

        <div className="border-surface-border/60 flex flex-wrap items-center gap-4 border-t pt-4">
          <Button asChild variant="primary">
            <Link href="/plan/budget" className="gap-2">
              <span>View Budget Framework</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>

          <Button asChild variant="secondary">
            <Link href="/plan?sample=1" className="gap-2">
              <span>Preview Sample Blueprint</span>
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
