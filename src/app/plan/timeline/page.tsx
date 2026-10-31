'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Clock,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  Info,
  Sparkles,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';
import { usePlan } from '@/context/plan-context';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { StatusChip } from '@/components/ui/status-chip';
import { MilestoneItem } from '@/domain/rules/timeline';
import { daysBetween, addDays } from '@/domain/dates';
import { sha256Hex } from '@/lib/hash';

interface CalendarLinkItem {
  milestoneId: string;
  title: string;
  date: string;
  critical: boolean;
  phase: 'before' | 'after';
  googleCalendarUrl: string;
}

// Formats YYYY-MM-DD into "Sat, 14 Nov 2026"
function formatPrettyDate(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return dateStr;
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return dateStr;
  }
}

// Formats Month Year for headers: "November 2026"
function formatMonthHeader(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return dateStr;
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.toLocaleDateString('en-IN', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return dateStr;
  }
}

function buildClientGoogleCalendarUrl(milestone: MilestoneItem, eventType?: string): string {
  const cleanTitle = (milestone.title || '').replace(/[\r\n]+/g, ' ').trim();
  const eventName = eventType ? ` [${eventType}]` : '';
  const text = `${cleanTitle}${eventName}`;
  const cleanDetail = (milestone.detail || '').replace(/[\r\n]+/g, ' ').trim();
  const verifyNote = milestone.verifyNote
    ? ` Note: ${(milestone.verifyNote || '').replace(/[\r\n]+/g, ' ').trim()}`
    : '';
  const details = `${cleanDetail}${verifyNote} - Planned with Utsav Planner`;

  const startDate = milestone.date.replace(/-/g, '');
  const nextDay = addDays(milestone.date, 1);
  const endDate = nextDay.replace(/-/g, '');

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text,
    dates: `${startDate}/${endDate}`,
    details,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export default function TimelinePage() {
  const { profile, plan, today, completedMilestones, toggleMilestone, loadSample, isHydrated } =
    usePlan();

  const [filter, setFilter] = useState<'all' | 'todo' | 'done'>('all');
  const [skipCompletedInIcs, setSkipCompletedInIcs] = useState(false);
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});
  const [openWhyDate, setOpenWhyDate] = useState<Record<string, boolean>>({});

  // Google Calendar Links State
  const [calendarLinks, setCalendarLinks] = useState<Record<string, string>>({});
  const [linksLoading, setLinksLoading] = useState(false);
  const [linksError, setLinksError] = useState(false);
  const [downloadingIcs, setDownloadingIcs] = useState(false);

  // Fetch calendar links once per profile hash
  useEffect(() => {
    if (!profile) return;

    let isMounted = true;
    async function fetchCalendarLinks() {
      try {
        const hash = await sha256Hex(JSON.stringify(profile));
        const cacheKey = `cal_links_${hash}`;
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (isMounted) setCalendarLinks(parsed);
          return;
        }

        setLinksLoading(true);
        setLinksError(false);

        const res = await fetch('/api/calendar/links', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profile }),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const map: Record<string, string> = {};
        if (Array.isArray(data.links)) {
          for (const item of data.links as CalendarLinkItem[]) {
            map[item.milestoneId] = item.googleCalendarUrl;
          }
        }

        if (isMounted) {
          setCalendarLinks(map);
          try {
            sessionStorage.setItem(cacheKey, JSON.stringify(map));
          } catch {
            // ignore cache write error
          }
        }
      } catch {
        if (isMounted) setLinksError(true);
      } finally {
        if (isMounted) setLinksLoading(false);
      }
    }

    fetchCalendarLinks();

    return () => {
      isMounted = false;
    };
  }, [profile]);

  // ICS Download handler
  const handleDownloadIcs = useCallback(async () => {
    if (!profile) return;
    setDownloadingIcs(true);
    try {
      const payload: { profile: typeof profile; excludeMilestoneIds?: string[] } = {
        profile,
      };
      if (skipCompletedInIcs && completedMilestones.length > 0) {
        payload.excludeMilestoneIds = completedMilestones.slice(0, 50);
      }

      const res = await fetch('/api/calendar/ics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'event-timeline.ics';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Failed to download .ics', err);
    } finally {
      setDownloadingIcs(false);
    }
  }, [profile, skipCompletedInIcs, completedMilestones]);

  const toggleDetail = (id: string) => {
    setExpandedDetails((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleWhyDate = (id: string) => {
    setOpenWhyDate((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Grouping logic:
  // 1. "Do now" group (catchUp items)
  // 2. Month-by-month groups (non-catchup pre-event items)
  // 3. "After the celebration" group (post-event items)
  const groupedMilestones = useMemo(() => {
    if (!plan) return [];

    const all = plan.timeline.milestones;
    const completedSet = new Set(completedMilestones);

    // Apply filter: 'all' | 'todo' | 'done'
    const filtered = all.filter((m) => {
      const isDone = completedSet.has(m.id);
      if (filter === 'todo') return !isDone;
      if (filter === 'done') return isDone;
      return true;
    });

    const groups: Array<{
      key: string;
      title: string;
      isCatchUpGroup?: boolean;
      items: MilestoneItem[];
    }> = [];

    // Group A: Catch-up items
    const catchUps = filtered.filter((m) => m.catchUp);
    if (catchUps.length > 0) {
      groups.push({
        key: 'catch_up',
        title: 'Do now',
        isCatchUpGroup: true,
        items: catchUps,
      });
    }

    // Group B: Pre-event future items grouped by month
    const futurePreEvent = filtered.filter((m) => !m.catchUp && m.phase === 'before');
    const monthMap = new Map<string, MilestoneItem[]>();
    for (const m of futurePreEvent) {
      const monthKey = m.date.slice(0, 7); // YYYY-MM
      if (!monthMap.has(monthKey)) monthMap.set(monthKey, []);
      monthMap.get(monthKey)!.push(m);
    }

    // Sort month groups chronologically
    const sortedMonthKeys = Array.from(monthMap.keys()).sort();
    for (const k of sortedMonthKeys) {
      const items = monthMap.get(k)!;
      const monthTitle = formatMonthHeader(items[0]!.date);
      groups.push({
        key: k,
        title: monthTitle,
        items,
      });
    }

    // Group C: Post-event items
    const postEvent = filtered.filter((m) => m.phase === 'after');
    if (postEvent.length > 0) {
      groups.push({
        key: 'after_event',
        title: 'After the celebration',
        items: postEvent,
      });
    }

    return groups;
  }, [plan, completedMilestones, filter]);

  // Loading skeleton
  if (!isHydrated) {
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

  // Empty State
  if (!profile || !plan) {
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

  const allMilestones = plan.timeline.milestones;
  const totalCount = allMilestones.length;
  const completedCount = allMilestones.filter((m) => completedMilestones.includes(m.id)).length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const todoCount = totalCount - completedCount;

  return (
    <div className="w-full space-y-8 text-left">
      {/* Header */}
      <header className="flex flex-col justify-between gap-4 border-b border-surface-border pb-5 sm:flex-row sm:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-surface-border/50 rounded px-2 py-0.5 text-xs font-semibold capitalize text-ink">
              {plan.mode === 'standard' ? 'Standard Timeline' : 'Compressed Plan'}
            </span>
            <span className="bg-secondary/10 rounded px-2 py-0.5 text-xs font-semibold text-secondary">
              {plan.daysToEvent} days remaining
            </span>
          </div>
          <h1 className="mt-2 font-serif text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Celebration Timeline
          </h1>
          <p className="text-ink/75 mt-1 text-xs sm:text-sm">
            Backward-scheduled planning milestones aligned with Indian celebration lead times.
          </p>
        </div>

        {/* Top-level Calendar ICS action */}
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadIcs}
              disabled={downloadingIcs}
              className="gap-2 text-xs"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{downloadingIcs ? 'Generating...' : 'Download .ics (all)'}</span>
            </Button>
          </div>

          <label className="text-ink/75 flex cursor-pointer items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={skipCompletedInIcs}
              onChange={(e) => setSkipCompletedInIcs(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-surface-border text-primary focus:ring-primary"
            />
            <span>Skip completed milestones</span>
          </label>
        </div>
      </header>

      {/* Helper text about Calendar Integration */}
      <div className="text-ink/75 rounded-control border border-surface-border bg-surface px-4 py-2 text-xs">
        <span className="font-semibold text-ink">Zero-OAuth privacy:</span> Works with Google
        Calendar, Apple Calendar, and Outlook. No sign-in required: we never access your personal
        accounts.
      </div>

      {/* Progress & Filters Bar */}
      <section
        aria-labelledby="timeline-progress-heading"
        className="space-y-4 rounded-card border border-surface-border bg-surface p-4 sm:p-5"
      >
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2
              id="timeline-progress-heading"
              className="text-ink/70 text-xs font-semibold uppercase tracking-wider"
            >
              Milestone Progress
            </h2>
            <p className="mt-1 text-sm font-semibold text-ink">
              {completedCount} of {totalCount} done ({progressPercent}%)
            </p>
          </div>

          {/* Filter Radio Group */}
          <div
            role="radiogroup"
            aria-label="Filter milestones by completion status"
            className="inline-flex rounded-control border border-surface-border bg-bg p-1 text-xs"
          >
            <button
              type="button"
              role="radio"
              aria-checked={filter === 'all'}
              onClick={() => setFilter('all')}
              className={`rounded px-3 py-1 font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-surface font-semibold text-ink shadow-sm'
                  : 'text-ink/70 hover:text-ink'
              }`}
            >
              All ({totalCount})
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={filter === 'todo'}
              onClick={() => setFilter('todo')}
              className={`rounded px-3 py-1 font-medium transition-colors ${
                filter === 'todo'
                  ? 'bg-surface font-semibold text-ink shadow-sm'
                  : 'text-ink/70 hover:text-ink'
              }`}
            >
              To do ({todoCount})
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={filter === 'done'}
              onClick={() => setFilter('done')}
              className={`rounded px-3 py-1 font-medium transition-colors ${
                filter === 'done'
                  ? 'bg-surface font-semibold text-ink shadow-sm'
                  : 'text-ink/70 hover:text-ink'
              }`}
            >
              Done ({completedCount})
            </button>
          </div>
        </div>

        {/* Accessible Progress Bar */}
        <div
          role="progressbar"
          aria-valuenow={completedCount}
          aria-valuemin={0}
          aria-valuemax={totalCount}
          aria-label="Milestone completion progress"
          className="bg-surface-border/50 h-2 w-full overflow-hidden rounded-full"
        >
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </section>

      {/* Link-fetch Failure Notice */}
      {linksError && (
        <div
          role="status"
          className="border-warning/30 bg-warning/5 text-ink/80 flex items-center gap-2 rounded-control border px-4 py-2.5 text-xs"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
          <span>
            Google Calendar links are temporarily unavailable. All milestone dates remain accessible
            offline.
          </span>
        </div>
      )}

      {/* Vertical Timeline Structure (Continuous 2px rail) */}
      <div className="relative space-y-10 pl-6 before:absolute before:bottom-3 before:left-2.5 before:top-3 before:w-0.5 before:bg-surface-border">
        {groupedMilestones.map((group) => (
          <section key={group.key} aria-labelledby={`group-${group.key}`} className="space-y-4">
            {/* Group Header */}
            <div className="flex items-center gap-2">
              <h2
                id={`group-${group.key}`}
                className="font-serif text-xl font-bold tracking-tight text-ink"
              >
                {group.title}
              </h2>
              {group.isCatchUpGroup && (
                <span className="bg-warning/15 rounded px-2 py-0.5 text-xs font-semibold text-warning">
                  Immediate attention
                </span>
              )}
            </div>

            {/* Group Milestones List */}
            <ol className="divide-surface-border/60 divide-y rounded-card border border-surface-border bg-surface">
              {group.items.map((m) => {
                const isDone = completedMilestones.includes(m.id);
                const isDetailExpanded = Boolean(expandedDetails[m.id]);
                const isWhyDateExpanded = Boolean(openWhyDate[m.id]);
                const gCalUrl =
                  calendarLinks[m.id] || buildClientGoogleCalendarUrl(m, profile?.eventType);
                const daysDiff = daysBetween(today, m.date);

                return (
                  <li
                    key={m.id}
                    className={`relative p-4 transition-colors sm:p-5 ${isDone ? 'bg-bg/20' : ''}`}
                  >
                    {/* Node circle on rail */}
                    <div
                      aria-hidden="true"
                      className={`absolute -left-[27px] top-5 flex h-4 w-4 items-center justify-center rounded-full border-2 bg-surface transition-colors ${
                        isDone ? 'border-primary bg-primary text-white' : 'border-surface-border'
                      }`}
                    >
                      {isDone && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                    </div>

                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      {/* Left: Checkbox & Content */}
                      <div className="flex flex-1 items-start gap-3">
                        <div className="pt-0.5">
                          <Checkbox
                            id={`chk-${m.id}`}
                            checked={isDone}
                            onCheckedChange={() => toggleMilestone(m.id)}
                            aria-label={`Mark done: ${m.title}`}
                          />
                        </div>

                        <div className="space-y-1">
                          {/* Title and Status Tags */}
                          <div className="flex flex-wrap items-center gap-2">
                            <label
                              htmlFor={`chk-${m.id}`}
                              className={`cursor-pointer text-sm font-semibold sm:text-base ${
                                isDone ? 'text-ink/50 line-through' : 'text-ink'
                              }`}
                            >
                              {m.title}
                            </label>

                            {isDone && (
                              <span className="bg-secondary/15 rounded px-1.5 py-0.5 text-[11px] font-semibold text-secondary">
                                Done
                              </span>
                            )}

                            {m.critical && (
                              <StatusChip status="critical" customLabel="Critical" size="sm" />
                            )}
                          </div>

                          {/* Mobile-only date display */}
                          <div className="text-ink/75 text-xs sm:hidden">
                            {m.catchUp ? (
                              <span className="font-semibold text-warning">Do now</span>
                            ) : (
                              <span>
                                {formatPrettyDate(m.date)}{' '}
                                <span className="text-ink/60">
                                  {daysDiff === 0
                                    ? '(today)'
                                    : daysDiff === 1
                                      ? '(tomorrow)'
                                      : `(in ${daysDiff} days)`}
                                </span>
                              </span>
                            )}
                          </div>

                          {/* Expandable detail */}
                          <div className="pt-1">
                            <p
                              className={`text-ink/80 text-xs sm:text-sm ${
                                isDetailExpanded ? '' : 'line-clamp-2'
                              }`}
                            >
                              {m.detail}
                            </p>

                            <button
                              type="button"
                              onClick={() => toggleDetail(m.id)}
                              aria-expanded={isDetailExpanded}
                              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-secondary hover:underline"
                            >
                              <span>{isDetailExpanded ? 'Show less' : 'Read more'}</span>
                              {isDetailExpanded ? (
                                <ChevronUp className="h-3 w-3" aria-hidden="true" />
                              ) : (
                                <ChevronDown className="h-3 w-3" aria-hidden="true" />
                              )}
                            </button>
                          </div>

                          {/* Info Callout for verifyNote */}
                          {m.verifyNote && (
                            <div className="border-secondary/20 bg-secondary/5 mt-2 flex items-start gap-2 rounded-control border p-2.5 text-xs text-ink">
                              <Info
                                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-secondary"
                                aria-hidden="true"
                              />
                              <span>{m.verifyNote}</span>
                            </div>
                          )}

                          {/* "Why this date?" Disclosure */}
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => toggleWhyDate(m.id)}
                              aria-expanded={isWhyDateExpanded}
                              className="text-ink/60 text-xs underline hover:text-ink"
                            >
                              Why this date?
                            </button>

                            {isWhyDateExpanded && (
                              <p className="text-ink/75 mt-1 text-xs italic">
                                {m.catchUp
                                  ? `Normally scheduled ${m.standardOffsetDays} days before the celebration. Moved to today because that date has passed.`
                                  : `Normally scheduled ${m.standardOffsetDays} days before the celebration (${m.daysBeforeEvent} days remaining).`}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Desktop Date & Google Calendar Link */}
                      <div className="flex shrink-0 flex-col items-start gap-2 sm:w-44 sm:items-end">
                        <div className="hidden text-right text-xs tabular-nums sm:block">
                          {m.catchUp ? (
                            <span className="bg-warning/15 rounded px-2 py-0.5 font-semibold text-warning">
                              Do now
                            </span>
                          ) : (
                            <div>
                              <p className="font-semibold text-ink">{formatPrettyDate(m.date)}</p>
                              <p className="text-ink/60">
                                {daysDiff === 0
                                  ? 'Today'
                                  : daysDiff === 1
                                    ? 'Tomorrow'
                                    : `In ${daysDiff} days`}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Google Calendar Link */}
                        {gCalUrl && (
                          <a
                            href={gCalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Add to Google Calendar: ${m.title} (opens in new tab)`}
                            className="inline-flex items-center gap-1 text-xs font-medium text-secondary hover:underline"
                          >
                            <span>Add to Google Calendar</span>
                            <ExternalLink className="h-3 w-3" aria-hidden="true" />
                          </a>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
