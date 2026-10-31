'use client';

import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  CalendarDays,
  IndianRupee,
  Clock,
  ArrowRight,
  RotateCw,
  Square,
  AlertTriangle,
  Trash2,
  Edit3,
  Bot,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/ui/status-chip';
import { MoneyDisplay } from '@/components/ui/money-display';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { usePlan } from '@/context/plan-context';
import { fetchAiIdeas, IdeasResponse, ClientApiError } from '@/lib/client-fetch';
import { buildIdeasCacheKey } from '@/lib/hash';

export default function PlanHomePage() {
  const router = useRouter();
  const { profile, plan, isHydrated, loadSample, reset } = usePlan();

  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);

  // AI Ideas state
  const [ideas, setIdeas] = useState<IdeasResponse | null>(null);
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [isSlowWriting, setIsSlowWriting] = useState(false);
  const [ideasError, setIdeasError] = useState<ClientApiError | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Trigger AI Ideas fetch when profile changes or on refresh
  const fetchIdeas = React.useCallback(
    async (forceRefresh = false) => {
      if (!profile) return;

      const cacheKey = buildIdeasCacheKey({
        eventType: profile.eventType,
        cityName: profile.cityName || '',
        guestCount: profile.guestCount,
        budgetTier: profile.budgetTier,
        notes: profile.notes,
      });

      if (!forceRefresh) {
        try {
          const cached = sessionStorage.getItem(cacheKey);
          if (cached) {
            setIdeas(JSON.parse(cached));
            setIdeasLoading(false);
            setIdeasError(null);
            return;
          }
        } catch {
          // ignore cache read error
        }
      }

      // Abort previous in-flight request if any
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
      setIsSlowWriting(false);
      slowTimerRef.current = setTimeout(() => {
        setIsSlowWriting(true);
      }, 6000);

      setIdeasLoading(true);
      setIdeasError(null);

      const res = await fetchAiIdeas(profile, controller.signal);

      if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
      setIsSlowWriting(false);

      if (res.ok) {
        setIdeas(res.data);
        setIdeasLoading(false);
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(res.data));
        } catch {
          // ignore cache write error
        }
      } else {
        setIdeasLoading(false);
        setIdeasError(res.error);
      }
    },
    [profile]
  );

  useEffect(() => {
    if (profile) {
      fetchIdeas(false);
    }
    return () => {
      if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
      abortControllerRef.current?.abort();
    };
  }, [profile, fetchIdeas]);

  const handleStopGeneration = () => {
    if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
    setIsSlowWriting(false);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIdeasLoading(false);
    setIdeasError({
      isError: true,
      code: 'ABORTED',
      message: 'Idea generation was stopped by user.',
    });
  };

  const handleConfirmClear = () => {
    reset();
    setIsClearDialogOpen(false);
    try {
      sessionStorage.clear();
    } catch {}
    router.push('/');
  };

  // SSR Skeleton
  if (!isHydrated) {
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

  // Empty State
  if (!profile || !plan) {
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
              onClick={() => loadSample('wedding')}
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

  // Active Plan View
  const eventLabel =
    profile.eventType === 'wedding'
      ? 'Indian Wedding'
      : profile.eventType === 'birthday_kids'
        ? 'Kids Birthday'
        : profile.eventType === 'birthday_adult'
          ? 'Milestone Birthday'
          : 'Community Festival';

  const nextMilestone =
    plan.timeline.milestones.find((m) => m.critical || m.phase === 'before') ||
    plan.timeline.milestones[0];

  const cateringStatus = plan.budget.estimates.catering.status;
  const upcomingMilestones = plan.timeline.milestones.slice(0, 3);

  const providerLabel =
    ideas?.meta?.provider === 'jarvis'
      ? 'Gemma via Jarvis'
      : ideas?.meta?.provider === 'gemini'
        ? 'Google Gemini'
        : 'Deterministic Template';

  return (
    <div className="w-full space-y-8 text-left">
      {/* Header */}
      <header className="flex flex-col justify-between gap-4 border-b border-surface-border pb-5 sm:flex-row sm:items-center">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-secondary">
            Active Blueprint
          </span>
          <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            {eventLabel} in {profile.cityName}
          </h1>
          <p className="text-ink/75 text-xs sm:text-sm">
            {profile.eventDate} • {profile.guestCount} guests • {profile.cityTier.toUpperCase()}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
            <Link href="/plan/new?edit=1">
              <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Edit details</span>
            </Link>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsClearDialogOpen(true)}
            className="hover:bg-danger/10 gap-1.5 text-xs text-danger hover:text-danger"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Clear my data</span>
          </Button>
        </div>
      </header>

      {/* Privacy Note */}
      <div className="text-ink/75 rounded-control border border-surface-border bg-surface px-4 py-2.5 text-xs">
        <span className="font-semibold text-ink">Privacy guaranteed:</span> Your celebration details
        are stored only in your browser. We never create accounts or store your profile on our
        servers.
      </div>

      {/* 4 Stat Blocks */}
      <section aria-labelledby="stats-heading">
        <h2 id="stats-heading" className="sr-only">
          Key Planning Metrics
        </h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {/* Stat 1: Days to go */}
          <div className="rounded-card border border-surface-border bg-surface p-4">
            <p className="text-ink/60 text-xs uppercase tracking-wider">Timeline</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-ink">
              {plan.daysToEvent} <span className="text-ink/70 text-sm font-normal">days to go</span>
            </p>
            <div className="mt-2">
              <span className="bg-surface-border/50 inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize text-ink">
                {plan.mode} Mode
              </span>
            </div>
          </div>

          {/* Stat 2: Total Budget */}
          <div className="rounded-card border border-surface-border bg-surface p-4">
            <p className="text-ink/60 text-xs uppercase tracking-wider">Total Budget</p>
            <div className="mt-1 text-2xl font-bold text-ink">
              <MoneyDisplay amount={plan.budget.total} />
            </div>
            <p className="text-ink/65 mt-2 truncate text-xs">
              {plan.budget.lines.length} categories allocated
            </p>
          </div>

          {/* Stat 3: Catering Status */}
          <div className="rounded-card border border-surface-border bg-surface p-4">
            <p className="text-ink/60 text-xs uppercase tracking-wider">Catering Buffer</p>
            <div className="mt-2">
              <StatusChip
                status={cateringStatus}
                customLabel={
                  cateringStatus === 'ok'
                    ? 'Within Budget'
                    : cateringStatus === 'tight'
                      ? 'Tight Catering'
                      : 'Catering Over'
                }
              />
            </div>
            <p className="text-ink/65 mt-2 truncate text-xs">
              Mid-estimate: <MoneyDisplay amount={plan.budget.estimates.catering.mid} />
            </p>
          </div>

          {/* Stat 4: Next Milestone */}
          <div className="rounded-card border border-surface-border bg-surface p-4">
            <p className="text-ink/60 text-xs uppercase tracking-wider">Next Milestone</p>
            <p className="mt-1 truncate font-serif text-sm font-bold text-ink">
              {nextMilestone ? nextMilestone.title : 'All Milestones Scheduled'}
            </p>
            <p className="text-ink/70 mt-2 text-xs tabular-nums">
              {nextMilestone
                ? nextMilestone.catchUp
                  ? 'Do now'
                  : `Target: ${nextMilestone.date}`
                : 'Planning on track'}
            </p>
          </div>
        </div>
      </section>

      {/* 12-Column Grid Layout */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Main Column (8 cols) */}
        <div className="space-y-8 lg:col-span-8">
          {/* Engine Heads-Up Flags */}
          {plan.flags.length > 0 && (
            <section aria-labelledby="heads-up-heading" className="space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" aria-hidden="true" />
                <h2 id="heads-up-heading" className="font-serif text-xl font-bold text-ink">
                  Heads-up Recommendations
                </h2>
              </div>

              <div className="space-y-3">
                {plan.flags.map((flag, idx) => (
                  <div
                    key={`${flag.code}-${idx}`}
                    className="flex items-start gap-3 rounded-card border border-surface-border bg-surface p-4 text-left"
                  >
                    <StatusChip status={flag.severity} size="sm" />
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-semibold text-ink">{flag.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Ideas for Your Celebration Card */}
          <section
            aria-labelledby="ideas-heading"
            className="rounded-card border border-surface-border bg-surface p-6 text-left"
          >
            <div className="border-surface-border/60 flex flex-wrap items-center justify-between gap-3 border-b pb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-secondary" aria-hidden="true" />
                <h2 id="ideas-heading" className="font-serif text-xl font-bold text-ink">
                  Ideas for your celebration
                </h2>
              </div>

              <div className="flex items-center gap-2">
                {ideasLoading && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleStopGeneration}
                    aria-label="Stop idea generation and use offline template ideas"
                    className="h-8 gap-1.5 text-xs focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <Square className="h-3 w-3 fill-current" aria-hidden="true" />
                    <span>Stop</span>
                  </Button>
                )}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fetchIdeas(true)}
                  disabled={ideasLoading}
                  className="h-8 gap-1.5 text-xs"
                >
                  <RotateCw className={`h-3 w-3 ${ideasLoading ? 'animate-spin' : ''}`} />
                  <span>Refresh ideas</span>
                </Button>
              </div>
            </div>

            {/* Ideas Card Body */}
            <div className="pt-4">
              {ideasLoading ? (
                <div className="space-y-4" aria-busy="true">
                  {isSlowWriting && (
                    <div
                      role="status"
                      aria-live="polite"
                      className="border-secondary/30 bg-secondary/10 rounded-control border px-3 py-2 text-xs font-medium text-secondary"
                    >
                      Still writing... you can stop and use the offline ideas
                    </div>
                  )}
                  <div className="bg-surface-border/50 h-4 w-1/3 animate-pulse rounded" />
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="bg-bg/50 space-y-2 rounded-control p-4">
                        <div className="bg-surface-border/60 h-4 w-1/4 animate-pulse rounded" />
                        <div className="bg-surface-border/40 h-3 w-5/6 animate-pulse rounded" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : ideasError ? (
                <div className="border-warning/30 bg-warning/5 rounded-control border p-4 text-xs">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                    <div className="space-y-1">
                      <p className="font-semibold text-warning">{ideasError.message}</p>
                      {ideasError.retryAfterSeconds && (
                        <p className="text-ink/75">
                          Retry recommendation: wait {ideasError.retryAfterSeconds} seconds before
                          requesting fresh AI ideas.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : ideas?.data?.themes ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {ideas.data.themes.map((theme, idx) => (
                      <div
                        key={idx}
                        className="border-surface-border/80 bg-bg/40 flex flex-col justify-between rounded-control border p-4"
                      >
                        <div>
                          <h3 className="font-serif text-sm font-bold text-ink">{theme.title}</h3>
                          <p className="text-ink/80 mt-2 text-xs leading-relaxed">
                            {theme.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-surface-border/60 text-ink/60 flex flex-wrap items-center justify-between border-t pt-3 text-xs">
                    <span>Written by AI: {providerLabel}</span>
                    <span>
                      Ideas are AI-written. Numbers and dates come from the planning engine.
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        </div>

        {/* Side Column (4 cols) */}
        <aside
          aria-label="Upcoming Milestones & Budget Overview"
          className="space-y-6 lg:col-span-4"
        >
          {/* Next Up Milestones */}
          <div className="rounded-card border border-surface-border bg-surface p-5 text-left">
            <div className="border-surface-border/60 flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-secondary" aria-hidden="true" />
                <h2 className="font-serif text-base font-bold text-ink">Next Up</h2>
              </div>
              <Link
                href="/plan/timeline"
                className="text-xs font-medium text-primary hover:underline"
              >
                View all
              </Link>
            </div>

            <ol className="mt-4 space-y-3">
              {upcomingMilestones.map((milestone, idx) => (
                <li
                  key={milestone.id || idx}
                  className="border-surface-border/40 flex items-start justify-between gap-2 border-b pb-2.5 last:border-0 last:pb-0"
                >
                  <div className="space-y-0.5">
                    <Link
                      href="/plan/timeline"
                      className="text-xs font-semibold text-ink transition-colors hover:text-primary"
                    >
                      {milestone.title}
                    </Link>
                    <p className="text-ink/65 text-xs">{milestone.detail}</p>
                  </div>
                  {milestone.catchUp ? (
                    <span className="bg-warning/15 shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold text-warning">
                      Do now
                    </span>
                  ) : (
                    <span className="shrink-0 text-xs font-medium tabular-nums text-secondary">
                      {milestone.date}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </div>

          {/* Quick Budget Link Card */}
          <div className="rounded-card border border-surface-border bg-surface p-5 text-left">
            <div className="border-surface-border/60 flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <IndianRupee className="h-4 w-4 text-primary" aria-hidden="true" />
                <h2 className="font-serif text-base font-bold text-ink">Budget Blueprint</h2>
              </div>
              <span className="text-ink/60 text-xs">Deterministic</span>
            </div>

            <div className="my-3 space-y-1">
              <p className="text-ink/75 text-xs">Total Estimated Expense</p>
              <div className="text-xl font-bold text-ink">
                <MoneyDisplay amount={plan.budget.total} />
              </div>
            </div>

            <Button asChild variant="primary" className="w-full gap-2 text-xs">
              <Link href="/plan/budget">
                <span>View Full Budget & What-If</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </Button>
          </div>

          {/* Ask Assistant Shortcut Card */}
          <div className="rounded-card border border-surface-border bg-surface p-5 text-left">
            <div className="border-surface-border/60 flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-secondary" aria-hidden="true" />
                <h2 className="font-serif text-base font-bold text-ink">Ask a Question</h2>
              </div>
              <span className="text-ink/60 text-xs">AI Assistant</span>
            </div>

            <p className="text-ink/75 my-3 text-xs leading-relaxed">
              Have questions about rituals, what-if budget shifts, or vendor negotiation?
            </p>

            <Button asChild variant="outline" className="w-full gap-2 text-xs">
              <Link href="/plan/ask">
                <span>Chat with Assistant</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </aside>
      </div>

      {/* Confirmation Dialog for "Clear My Data" */}
      <Dialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Clear All Celebration Data?</DialogTitle>
            <DialogDescription>
              This will permanently delete your celebration plan and local overrides from this
              browser. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsClearDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="danger" onClick={handleConfirmClear}>
              Clear Data
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
