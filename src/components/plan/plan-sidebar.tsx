'use client';

import * as React from 'react';
import Link from 'next/link';
import { Clock, IndianRupee, ArrowRight, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MoneyDisplay } from '@/components/ui/money-display';
import { BasePlan } from '@/domain/rules/plan';

interface PlanSidebarProps {
  plan: BasePlan;
}

export function PlanSidebar({ plan }: PlanSidebarProps) {
  const upcomingMilestones = plan.timeline.milestones.slice(0, 3);

  return (
    <aside aria-label="Upcoming Milestones & Budget Overview" className="space-y-6 lg:col-span-4">
      {/* Next Up Milestones */}
      <div className="rounded-card border border-surface-border bg-surface p-5 text-left">
        <div className="border-surface-border/60 flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-secondary" aria-hidden="true" />
            <h2 className="font-serif text-base font-bold text-ink">Next Up</h2>
          </div>
          <Link href="/plan/timeline" className="text-xs font-medium text-primary hover:underline">
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
  );
}
