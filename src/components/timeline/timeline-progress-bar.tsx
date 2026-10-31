'use client';

import * as React from 'react';

interface TimelineProgressBarProps {
  completedCount: number;
  totalCount: number;
  progressPercent: number;
  todoCount: number;
  filter: 'all' | 'todo' | 'done';
  onFilterChange: (filter: 'all' | 'todo' | 'done') => void;
}

export function TimelineProgressBar({
  completedCount,
  totalCount,
  progressPercent,
  todoCount,
  filter,
  onFilterChange,
}: TimelineProgressBarProps) {
  return (
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
            onClick={() => onFilterChange('all')}
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
            onClick={() => onFilterChange('todo')}
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
            onClick={() => onFilterChange('done')}
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
  );
}
