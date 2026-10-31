'use client';

import * as React from 'react';
import { BasePlan } from '@/domain/rules/plan';
import { MoneyDisplay } from '@/components/ui/money-display';
import { StatusChip } from '@/components/ui/status-chip';

interface PlanStatBlocksProps {
  plan: BasePlan;
}

export function PlanStatBlocks({ plan }: PlanStatBlocksProps) {
  const nextMilestone =
    plan.timeline.milestones.find((m) => m.critical || m.phase === 'before') ||
    plan.timeline.milestones[0];

  const cateringStatus = plan.budget.estimates.catering.status;

  return (
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
  );
}
