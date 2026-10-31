'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Download, AlertTriangle } from 'lucide-react';
import { usePlan } from '@/context/plan-context';
import { Button } from '@/components/ui/button';
import { MilestoneItem } from '@/domain/rules/timeline';
import { sha256Hex } from '@/lib/hash';
import { CalendarLinkItem, formatMonthHeader } from '@/components/timeline/timeline-date-utils';
import { TimelineEmptyState, TimelineSkeleton } from '@/components/timeline/timeline-empty-state';
import { TimelineProgressBar } from '@/components/timeline/timeline-progress-bar';
import { TimelineItemRow } from '@/components/timeline/timeline-item';

export default function TimelinePage() {
  const { profile, plan, today, completedMilestones, toggleMilestone, loadSample, isHydrated } =
    usePlan();

  const [filter, setFilter] = useState<'all' | 'todo' | 'done'>('all');
  const [skipCompletedInIcs, setSkipCompletedInIcs] = useState(false);

  // Google Calendar Links State
  const [calendarLinks, setCalendarLinks] = useState<Record<string, string>>({});
  const [, setLinksLoading] = useState(false);
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
    return <TimelineSkeleton />;
  }

  // Empty State
  if (!profile || !plan) {
    return <TimelineEmptyState onLoadSample={loadSample} />;
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
      <TimelineProgressBar
        completedCount={completedCount}
        totalCount={totalCount}
        progressPercent={progressPercent}
        todoCount={todoCount}
        filter={filter}
        onFilterChange={setFilter}
      />

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
              {group.items.map((m) => (
                <TimelineItemRow
                  key={m.id}
                  milestone={m}
                  isDone={completedMilestones.includes(m.id)}
                  onToggle={toggleMilestone}
                  today={today}
                  calendarUrl={calendarLinks[m.id]}
                  eventType={profile?.eventType}
                />
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
