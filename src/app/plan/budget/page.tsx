'use client';

import * as React from 'react';
import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { IndianRupee, ShieldCheck, Sparkles, Info, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MoneyDisplay } from '@/components/ui/money-display';
import { usePlan } from '@/context/plan-context';
import { replan, ReplanResult } from '@/domain/rules/replan';
import { formatInr } from '@/domain/money/inr';
import { CategoryTable } from '@/components/budget/category-table';
import { CateringCard } from '@/components/budget/catering-card';
import { TipsCard } from '@/components/budget/tips-card';
import { WhatIfPanel } from '@/components/budget/what-if-panel';
import { AssumptionsDialog } from '@/components/budget/assumptions-dialog';

export default function BudgetPage() {
  const { profile, plan, today, setOverride, clearOverride, applyPatch, loadSample } = usePlan();
  const [isAssumptionsOpen, setIsAssumptionsOpen] = useState(false);

  // What-If Sandbox State (isolated from saved plan until Apply)
  const [whatIfGuests, setWhatIfGuests] = useState<number>(profile?.guestCount || 200);
  const [whatIfBudget, setWhatIfBudget] = useState<number>(profile?.totalBudgetInr || 2500000);
  const [whatIfDate, setWhatIfDate] = useState<string>(profile?.eventDate || '');
  const [liveAnnouncement, setLiveAnnouncement] = useState<string>('');

  const guestCount = profile?.guestCount;
  const totalBudgetInr = profile?.totalBudgetInr;
  const eventDate = profile?.eventDate;

  // Sync what-if defaults when plan changes or loads
  useEffect(() => {
    if (guestCount !== undefined && totalBudgetInr !== undefined && eventDate !== undefined) {
      setWhatIfGuests(guestCount);
      setWhatIfBudget(totalBudgetInr);
      setWhatIfDate(eventDate);
    }
  }, [guestCount, totalBudgetInr, eventDate]);

  // Client-side pure replan() calculation with ZERO network calls
  const replanOutput: ReplanResult | null = useMemo(() => {
    if (!plan || !whatIfDate) return null;
    return replan(
      plan,
      {
        guestCount: whatIfGuests,
        totalBudgetInr: whatIfBudget,
        eventDate: whatIfDate,
      },
      today
    );
  }, [plan, whatIfGuests, whatIfBudget, whatIfDate, today]);

  // Update live region announcement on what-if change
  useEffect(() => {
    if (replanOutput && replanOutput.ok) {
      const parts: string[] = [];
      if (replanOutput.diff.cateringEstimateDelta !== 0) {
        parts.push(
          `Catering estimate changed by ${formatInr(replanOutput.diff.cateringEstimateDelta)}`
        );
      }
      if (replanOutput.diff.totalDelta !== 0) {
        parts.push(`Total budget changed by ${formatInr(replanOutput.diff.totalDelta)}`);
      }
      if (replanOutput.diff.milestonesShifted.length > 0) {
        parts.push(`${replanOutput.diff.milestonesShifted.length} milestones shifted`);
      }
      if (parts.length > 0) {
        setLiveAnnouncement(parts.join('. '));
      }
    }
  }, [replanOutput]);

  const handleApplyWhatIf = () => {
    if (!replanOutput || !replanOutput.ok) return;
    applyPatch({
      guestCount: whatIfGuests,
      totalBudgetInr: whatIfBudget,
      eventDate: whatIfDate,
    });
    setLiveAnnouncement('What-if changes successfully applied to plan.');
  };

  const handleDiscardWhatIf = () => {
    if (profile) {
      setWhatIfGuests(profile.guestCount);
      setWhatIfBudget(profile.totalBudgetInr);
      setWhatIfDate(profile.eventDate);
      setLiveAnnouncement('What-if changes discarded.');
    }
  };

  if (!profile || !plan) {
    return (
      <div className="w-full space-y-6 text-left">
        <header className="border-b border-surface-border pb-4">
          <div className="inline-flex items-center gap-2 rounded-control border border-surface-border bg-surface px-3 py-1 text-xs font-semibold uppercase tracking-wider text-secondary">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Deterministic Splits</span>
          </div>
          <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight text-ink">
            Budget Allocation
          </h1>
          <p className="text-ink/75 mt-1 text-sm sm:text-base">
            Cost bands based on city tier and guest counts with zero network calls.
          </p>
        </header>

        <section
          aria-labelledby="budget-empty-heading"
          className="space-y-6 rounded-card border border-surface-border bg-surface p-8 sm:p-12"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-control bg-bg text-primary">
            <IndianRupee className="h-6 w-6" aria-hidden="true" />
          </div>

          <div className="max-w-xl space-y-2">
            <h2 id="budget-empty-heading" className="font-serif text-2xl font-bold text-ink">
              No budget plan configured yet
            </h2>
            <p className="text-ink/80 text-sm leading-relaxed sm:text-base">
              Set up your celebration details to calculate deterministic budget categories, catering
              multipliers, and instant what-if rebalancing.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Button asChild size="lg" variant="primary">
              <Link href="/plan/new" className="gap-2">
                <span>Configure Celebration</span>
                <ArrowRight className="h-4 w-4" />
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
              <Sparkles className="h-4 w-4 text-secondary" />
            </Button>
          </div>
        </section>
      </div>
    );
  }

  const { lines, total } = plan.budget;
  const catering = plan.budget.estimates.catering;
  const categoryLabels = lines.reduce<Record<string, string>>((acc, l) => {
    acc[l.id] = l.label;
    return acc;
  }, {});

  return (
    <div className="w-full space-y-8 text-left">
      {/* Header */}
      <header className="flex flex-col justify-between gap-4 border-b border-surface-border pb-5 sm:flex-row sm:items-center">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-secondary">
            Deterministic Budget Allocation
          </span>
          <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Budget Blueprint
          </h1>
          <p className="text-ink/75 text-xs sm:text-sm">
            Total Budget: <MoneyDisplay amount={total} /> • {profile.cityName} (
            {profile.cityTier.toUpperCase()})
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsAssumptionsOpen(true)}
            className="gap-1.5 text-xs"
          >
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Assumptions</span>
          </Button>
        </div>
      </header>

      {/* Categories Table & Progress Stack */}
      <CategoryTable
        lines={lines}
        total={total}
        onSetOverride={setOverride}
        onClearOverride={clearOverride}
      />

      {/* Catering Estimate Card */}
      <CateringCard
        catering={catering}
        guestCount={profile.guestCount}
        cityTier={profile.cityTier}
      />

      {/* Category Tips On-Demand Card */}
      <TipsCard profile={profile} categoryLabels={categoryLabels} />

      {/* WHAT-IF Sandbox Panel */}
      <WhatIfPanel
        whatIfGuests={whatIfGuests}
        setWhatIfGuests={setWhatIfGuests}
        whatIfBudget={whatIfBudget}
        setWhatIfBudget={setWhatIfBudget}
        whatIfDate={whatIfDate}
        setWhatIfDate={setWhatIfDate}
        liveAnnouncement={liveAnnouncement}
        replanOutput={replanOutput}
        onApply={handleApplyWhatIf}
        onDiscard={handleDiscardWhatIf}
      />

      {/* Assumptions Dialog */}
      <AssumptionsDialog
        isOpen={isAssumptionsOpen}
        onOpenChange={setIsAssumptionsOpen}
        assumptions={plan.assumptions}
      />
    </div>
  );
}
