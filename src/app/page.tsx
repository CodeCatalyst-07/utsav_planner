'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sparkles, Cake, Users, ArrowRight, ShieldCheck, Cpu, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DecorativeMotif } from '@/components/ui/decorative-motif';
import { usePlan } from '@/context/plan-context';

interface EventTypeOption {
  title: string;
  type: string;
  description: string;
  scaleHint: string;
  icon: React.ComponentType<{ className?: string }>;
}

const EVENT_TYPE_OPTIONS: EventTypeOption[] = [
  {
    title: 'Indian Wedding',
    type: 'wedding',
    description:
      'Multi-day traditions with authentic ritual lead times, guest per-plate models, and venue contingencies.',
    scaleHint: 'Typical: 150–600 guests • ₹15L–₹80L',
    icon: Sparkles,
  },
  {
    title: 'Milestone Birthday',
    type: 'birthday_adult',
    description:
      'Adult jubilees and kids birthday celebrations with venue splits, entertainer budgets, and curated schedules.',
    scaleHint: 'Typical: 30–120 guests • ₹50K–₹5L',
    icon: Cake,
  },
  {
    title: 'Community Festival',
    type: 'community_festival',
    description:
      'Pandal setup, cultural stages, community feasts, municipal permits, and crowd safety coordination.',
    scaleHint: 'Typical: 200–1,000+ attendees • ₹2L–₹15L',
    icon: Users,
  },
];

export default function HomePage() {
  const router = useRouter();
  const { loadSample } = usePlan();

  const handleTrySample = (kind: 'wedding' = 'wedding') => {
    loadSample(kind);
    router.push('/plan');
  };

  return (
    <main id="main-content" className="flex-1 pb-24 pt-8 sm:pt-12 lg:pb-16" tabIndex={-1}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <section aria-labelledby="hero-heading" className="max-w-3xl space-y-6 text-left">
          <div className="flex items-center gap-3">
            <DecorativeMotif size={40} className="text-accent" />
            <span className="text-xs font-semibold uppercase tracking-wider text-secondary">
              Transparent Indian Celebration Planner
            </span>
          </div>

          <h1
            id="hero-heading"
            className="font-serif text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl lg:text-5xl"
          >
            Plan the celebration. Keep the budget honest.
          </h1>

          <p className="text-ink/80 text-base leading-relaxed sm:text-lg">
            Deterministic calculations and realistic lead times for Indian celebrations, paired with
            transparent, non-hallucinatory AI ideas.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Button asChild size="lg" variant="primary">
              <Link href="/plan/new" className="gap-2">
                <span>Start New Plan</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>

            <Button
              type="button"
              size="lg"
              variant="outline"
              onClick={() => handleTrySample('wedding')}
              className="gap-2"
            >
              <span>Try a sample plan</span>
              <Sparkles className="h-4 w-4 text-secondary" aria-hidden="true" />
            </Button>
          </div>
        </section>

        {/* Event Type Tiles */}
        <section aria-labelledby="event-types-heading" className="sm:mt-18 mt-14">
          <div className="border-t border-surface-border pt-10">
            <div className="mb-6 max-w-2xl text-left">
              <h2
                id="event-types-heading"
                className="font-serif text-2xl font-bold tracking-tight text-ink"
              >
                Choose your celebration
              </h2>
              <p className="text-ink/75 mt-1 text-sm sm:text-base">
                Each celebration type uses authentic Indian cost benchmarks, tiered vendor splits,
                and backward lead-time scheduling.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {EVENT_TYPE_OPTIONS.map((event) => {
                const Icon = event.icon;
                return (
                  <Link
                    key={event.type}
                    href={`/plan/new?type=${event.type}`}
                    className="touch-target hover:border-primary/50 group flex flex-col justify-between rounded-card border border-surface-border bg-surface p-6 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <div>
                      <div className="flex h-11 w-11 items-center justify-center rounded-control bg-bg text-primary">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <h3 className="mt-4 font-serif text-xl font-bold text-ink group-hover:text-primary">
                        {event.title}
                      </h3>
                      <p className="text-ink/75 mt-2 text-sm leading-relaxed">
                        {event.description}
                      </p>
                    </div>

                    <div className="border-surface-border/60 mt-6 border-t pt-4">
                      <p className="text-ink/65 text-xs font-medium tabular-nums">
                        {event.scaleHint}
                      </p>
                      <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-primary">
                        <span>Configure blueprint</span>
                        <ArrowRight
                          className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1"
                          aria-hidden="true"
                        />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* Trust Row */}
        <section aria-labelledby="trust-heading" className="sm:mt-18 mt-14">
          <div className="rounded-card border border-surface-border bg-surface p-6 sm:p-8">
            <h2 id="trust-heading" className="sr-only">
              Our Planning Principles
            </h2>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="flex items-start gap-3.5 text-left">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-bg text-secondary">
                  <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-ink">
                    Numbers come from a transparent planning engine
                  </h3>
                  <p className="text-ink/70 mt-1 text-xs leading-relaxed">
                    Zero numerical hallucinations. Every rupee and milestone date is calculated
                    deterministically using verified regional data.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 text-left">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-bg text-secondary">
                  <Cpu className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-ink">AI writes the ideas</h3>
                  <p className="text-ink/70 mt-1 text-xs leading-relaxed">
                    Generative models suggest qualitative themes, customs, and decor nuances — never
                    your budget formulas.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 text-left">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-bg text-secondary">
                  <Database className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-ink">
                    Your data stays in your browser
                  </h3>
                  <p className="text-ink/70 mt-1 text-xs leading-relaxed">
                    No account required, zero tracking cookies, and your celebration plans are saved
                    only in your local browser storage.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
