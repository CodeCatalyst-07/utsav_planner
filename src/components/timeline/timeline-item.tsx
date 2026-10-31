'use client';

import * as React from 'react';
import { useState } from 'react';
import { Check, ChevronDown, ChevronUp, ExternalLink, Info } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { StatusChip } from '@/components/ui/status-chip';
import { MilestoneItem } from '@/domain/rules/timeline';
import { daysBetween } from '@/domain/dates';
import { formatPrettyDate, buildClientGoogleCalendarUrl } from './timeline-date-utils';

interface TimelineItemProps {
  milestone: MilestoneItem;
  isDone: boolean;
  onToggle: (id: string) => void;
  today: string;
  calendarUrl?: string;
  eventType?: string;
}

export function TimelineItemRow({
  milestone,
  isDone,
  onToggle,
  today,
  calendarUrl,
  eventType,
}: TimelineItemProps) {
  const [isDetailExpanded, setIsDetailExpanded] = useState(false);
  const [isWhyDateExpanded, setIsWhyDateExpanded] = useState(false);

  const gCalUrl = calendarUrl || buildClientGoogleCalendarUrl(milestone, eventType);
  const daysDiff = daysBetween(today, milestone.date);

  return (
    <li className={`relative p-4 transition-colors sm:p-5 ${isDone ? 'bg-bg/20' : ''}`}>
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
              id={`chk-${milestone.id}`}
              checked={isDone}
              onCheckedChange={() => onToggle(milestone.id)}
              aria-label={`Mark done: ${milestone.title}`}
            />
          </div>

          <div className="space-y-1">
            {/* Title and Status Tags */}
            <div className="flex flex-wrap items-center gap-2">
              <label
                htmlFor={`chk-${milestone.id}`}
                className={`cursor-pointer text-sm font-semibold sm:text-base ${
                  isDone ? 'text-ink/50 line-through' : 'text-ink'
                }`}
              >
                {milestone.title}
              </label>

              {isDone && (
                <span className="bg-secondary/15 rounded px-1.5 py-0.5 text-[11px] font-semibold text-secondary">
                  Done
                </span>
              )}

              {milestone.critical && (
                <StatusChip status="critical" customLabel="Critical" size="sm" />
              )}
            </div>

            {/* Mobile-only date display */}
            <div className="text-ink/75 text-xs sm:hidden">
              {milestone.catchUp ? (
                <span className="font-semibold text-warning">Do now</span>
              ) : (
                <span>
                  {formatPrettyDate(milestone.date)}{' '}
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
                className={`text-ink/80 text-xs sm:text-sm ${isDetailExpanded ? '' : 'line-clamp-2'}`}
              >
                {milestone.detail}
              </p>

              <button
                type="button"
                onClick={() => setIsDetailExpanded((v) => !v)}
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
            {milestone.verifyNote && (
              <div className="border-secondary/20 bg-secondary/5 mt-2 flex items-start gap-2 rounded-control border p-2.5 text-xs text-ink">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-secondary" aria-hidden="true" />
                <span>{milestone.verifyNote}</span>
              </div>
            )}

            {/* "Why this date?" Disclosure */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setIsWhyDateExpanded((v) => !v)}
                aria-expanded={isWhyDateExpanded}
                className="text-ink/60 text-xs underline hover:text-ink"
              >
                Why this date?
              </button>

              {isWhyDateExpanded && (
                <p className="text-ink/75 mt-1 text-xs italic">
                  {milestone.catchUp
                    ? `Normally scheduled ${milestone.standardOffsetDays} days before the celebration. Moved to today because that date has passed.`
                    : `Normally scheduled ${milestone.standardOffsetDays} days before the celebration (${milestone.daysBeforeEvent} days remaining).`}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right: Desktop Date & Google Calendar Link */}
        <div className="flex shrink-0 flex-col items-start gap-2 sm:w-44 sm:items-end">
          <div className="hidden text-right text-xs tabular-nums sm:block">
            {milestone.catchUp ? (
              <span className="bg-warning/15 rounded px-2 py-0.5 font-semibold text-warning">
                Do now
              </span>
            ) : (
              <div>
                <p className="font-semibold text-ink">{formatPrettyDate(milestone.date)}</p>
                <p className="text-ink/60">
                  {daysDiff === 0 ? 'Today' : daysDiff === 1 ? 'Tomorrow' : `In ${daysDiff} days`}
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
              aria-label={`Add to Google Calendar: ${milestone.title} (opens in new tab)`}
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
}
