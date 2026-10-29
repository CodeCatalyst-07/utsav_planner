import * as React from 'react';
import Link from 'next/link';
import { Sparkles, Calendar, Users, Cake, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BRAND_NAME } from '@/lib/brand';

interface EventTypeTile {
  title: string;
  description: string;
  href: string;
  badge: string;
  icon: React.ComponentType<{ className?: string }>;
}

const EVENT_TYPES: EventTypeTile[] = [
  {
    title: 'Indian Wedding',
    description:
      'Multi-day shaadis and intimate pheras with regional ritual lead times, per-plate bands, and vendor checklists.',
    href: '/plan?type=wedding',
    badge: 'Multi-Day Celebrations',
    icon: Sparkles,
  },
  {
    title: 'Milestone Birthday',
    description:
      '1st, 18th, 50th, and 75th jubilees with entertainment schedules, caterer estimates, and guest itineraries.',
    href: '/plan?type=birthday',
    badge: 'Family & Jubilees',
    icon: Cake,
  },
  {
    title: 'Community Festival',
    description:
      'Diwali melas, Ganesh Utsav, and society gatherings with municipal permits, stage setups, and crowd safety.',
    href: '/plan?type=community',
    badge: 'Society & Cultural',
    icon: Users,
  },
];

export default function HomePage() {
  return (
    <main id="main-content" className="flex-1 pb-24 pt-8 sm:pt-12 lg:pb-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Hero Editorial Section */}
        <section aria-labelledby="hero-heading" className="max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-control border border-surface-border bg-surface px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-secondary">
            <span className="h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
            <span>Warm Editorial Planning for India</span>
          </div>

          <h1
            id="hero-heading"
            className="font-serif text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl lg:text-5xl"
          >
            Thoughtful celebrations, planned with calm precision.
          </h1>

          <p className="text-ink/80 text-base leading-relaxed sm:text-lg">
            {BRAND_NAME} brings structured clarity to weddings, birthdays, and community festivals.
            Get deterministic budget breakdowns, realistic lead-time calendars, and curated vendor
            coordination without spreadsheets or guesswork.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Button asChild size="lg" variant="primary">
              <Link href="/plan" className="gap-2">
                <span>Start New Plan</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>

            <Button asChild size="lg" variant="secondary">
              <Link href="/plan?sample=1" className="gap-2">
                <span>Try a Sample Plan</span>
                <Calendar className="h-4 w-4 text-secondary" />
              </Link>
            </Button>
          </div>
        </section>

        {/* Event Types Section */}
        <section aria-labelledby="event-types-heading" className="mt-16 sm:mt-20">
          <div className="border-t border-surface-border pt-10">
            <div className="mb-8 max-w-2xl">
              <h2
                id="event-types-heading"
                className="font-serif text-2xl font-bold tracking-tight text-ink"
              >
                Choose your celebration
              </h2>
              <p className="text-ink/75 mt-2 text-base">
                Every celebration in India has unique cultural milestones, vendor requirements, and
                lead times. Select a category below to explore its scaffolded blueprint.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {EVENT_TYPES.map((event) => {
                const Icon = event.icon;
                return (
                  <article
                    key={event.title}
                    className="hover:border-primary/40 flex flex-col justify-between rounded-card border border-surface-border bg-surface p-6 transition-all"
                  >
                    <div>
                      <div className="mb-4 flex items-center justify-between gap-4">
                        <span className="text-ink/80 inline-block rounded-control border border-surface-border bg-bg px-2.5 py-1 text-xs font-medium">
                          {event.badge}
                        </span>
                        <div className="flex h-10 w-10 items-center justify-center rounded-control border border-surface-border bg-bg text-primary">
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        </div>
                      </div>

                      <h3 className="font-serif text-xl font-bold text-ink">{event.title}</h3>

                      <p className="text-ink/75 mt-3 text-sm leading-relaxed">
                        {event.description}
                      </p>
                    </div>

                    <div className="border-surface-border/60 mt-6 border-t pt-4">
                      <Link
                        href={event.href}
                        className="hover:text-secondary/80 touch-target inline-flex items-center gap-1.5 rounded-control text-sm font-semibold text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <span>Explore {event.title} framework</span>
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
