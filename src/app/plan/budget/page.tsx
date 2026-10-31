'use client';

import * as React from 'react';
import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  IndianRupee,
  ShieldCheck,
  Sparkles,
  Sliders,
  Check,
  X,
  RotateCcw,
  Info,
  Calendar,
  Users,
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Minus,
  Plus,
  Square,
  Lightbulb,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { replan, ReplanResult } from '@/domain/rules/replan';
import { formatInr, inrSpoken } from '@/domain/money/inr';
import { getTomorrowInIst } from '@/lib/today';
import { fetchAiCategoryTips, CategoryTipsResponse, ClientApiError } from '@/lib/client-fetch';
import { buildCategoryTipsCacheKey } from '@/lib/hash';

const CATEGORY_COLORS: Record<string, string> = {
  venue: 'var(--cat-venue)',
  catering: 'var(--cat-catering)',
  decor: 'var(--cat-decor)',
  photo_video: 'var(--cat-photo_video)',
  attire_jewellery: 'var(--cat-attire_jewellery)',
  entertainment: 'var(--cat-entertainment)',
  stationery_gifts: 'var(--cat-stationery_gifts)',
  rituals_misc: 'var(--cat-rituals_misc)',
  cake_gifts: 'var(--cat-cake_gifts)',
  permissions_security: 'var(--cat-permissions_security)',
  cleanup_logistics: 'var(--cat-cleanup_logistics)',
  contingency: 'var(--cat-contingency)',
};

export default function BudgetPage() {
  const { profile, plan, today, setOverride, clearOverride, applyPatch, loadSample } = usePlan();

  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [overrideInputVal, setOverrideInputVal] = useState<string>('');
  const [isAssumptionsOpen, setIsAssumptionsOpen] = useState(false);
  const [openWhyFormulaId, setOpenWhyFormulaId] = useState<string | null>(null);
  const overrideInputRef = useRef<HTMLInputElement>(null);

  // Focus override input when entering edit mode
  useEffect(() => {
    if (editingCategoryId) {
      overrideInputRef.current?.focus();
    }
  }, [editingCategoryId]);

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

  // Debounced screen-reader announcement for What-If
  useEffect(() => {
    if (!replanOutput || !replanOutput.ok) return;
    const diff = replanOutput.diff;
    const timer = setTimeout(() => {
      const parts: string[] = [];
      if (diff.cateringEstimateDelta !== 0) {
        parts.push(
          `Catering estimate ${diff.cateringEstimateDelta > 0 ? 'increased by' : 'decreased by'} ${inrSpoken(
            Math.abs(diff.cateringEstimateDelta)
          )}`
        );
      }
      if (diff.totalDelta !== 0) {
        parts.push(
          `Total budget ${diff.totalDelta > 0 ? 'increased by' : 'decreased by'} ${inrSpoken(
            Math.abs(diff.totalDelta)
          )}`
        );
      }
      if (diff.milestonesShifted.length > 0) {
        parts.push(`${diff.milestonesShifted.length} milestones shifted`);
      }
      if (parts.length > 0) {
        setLiveAnnouncement(`What-if preview: ${parts.join(', ')}.`);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [replanOutput]);

  const handleApplyWhatIf = () => {
    if (!replanOutput || !replanOutput.ok) return;
    applyPatch({
      guestCount: whatIfGuests,
      totalBudgetInr: whatIfBudget,
      eventDate: whatIfDate,
    });
  };

  const handleDiscardWhatIf = () => {
    if (profile) {
      setWhatIfGuests(profile.guestCount);
      setWhatIfBudget(profile.totalBudgetInr);
      setWhatIfDate(profile.eventDate);
    }
  };

  const handleStartEdit = (categoryId: string, currentAmount: number) => {
    setEditingCategoryId(categoryId);
    setOverrideInputVal(currentAmount.toString());
  };

  const handleSaveOverride = (categoryId: string) => {
    const parsed = parseInt(overrideInputVal, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      setOverride(categoryId, parsed);
    }
    setEditingCategoryId(null);
  };

  const handleResetOverride = (categoryId: string) => {
    clearOverride(categoryId);
    setEditingCategoryId(null);
  };

  // On-demand Category Tips State
  const [categoryTips, setCategoryTips] = useState<CategoryTipsResponse | null>(null);
  const [tipsLoading, setTipsLoading] = useState(false);
  const [isSlowTipsWriting, setIsSlowTipsWriting] = useState(false);
  const [tipsError, setTipsError] = useState<ClientApiError | null>(null);
  const tipsAbortControllerRef = useRef<AbortController | null>(null);
  const tipsSlowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      tipsAbortControllerRef.current?.abort();
      if (tipsSlowTimerRef.current) clearTimeout(tipsSlowTimerRef.current);
    };
  }, []);

  const fetchTips = async (forceRefresh = false) => {
    if (!profile) return;
    const cacheKey = buildCategoryTipsCacheKey({
      eventType: profile.eventType,
      cityName: profile.cityName || '',
      totalBudgetInr: profile.totalBudgetInr,
      guestCount: profile.guestCount,
    });

    if (!forceRefresh) {
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          setCategoryTips(JSON.parse(cached));
          setTipsLoading(false);
          setTipsError(null);
          return;
        }
      } catch {}
    }

    if (tipsAbortControllerRef.current) {
      tipsAbortControllerRef.current.abort();
    }

    const controller = new AbortController();
    tipsAbortControllerRef.current = controller;

    if (tipsSlowTimerRef.current) clearTimeout(tipsSlowTimerRef.current);
    setIsSlowTipsWriting(false);
    tipsSlowTimerRef.current = setTimeout(() => {
      setIsSlowTipsWriting(true);
    }, 6000);

    setTipsLoading(true);
    setTipsError(null);

    const res = await fetchAiCategoryTips(profile, controller.signal);

    if (tipsSlowTimerRef.current) clearTimeout(tipsSlowTimerRef.current);
    setIsSlowTipsWriting(false);

    if (res.ok) {
      setCategoryTips(res.data);
      setTipsLoading(false);
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify(res.data));
      } catch {}
    } else {
      setTipsLoading(false);
      setTipsError(res.error);
    }
  };

  const handleStopTips = () => {
    if (tipsSlowTimerRef.current) clearTimeout(tipsSlowTimerRef.current);
    setIsSlowTipsWriting(false);
    if (tipsAbortControllerRef.current) {
      tipsAbortControllerRef.current.abort();
      tipsAbortControllerRef.current = null;
    }
    setTipsLoading(false);
    setTipsError({
      isError: true,
      code: 'ABORTED',
      message: 'Category tips generation was stopped by user.',
    });
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
  const sumLines = lines.reduce((acc, l) => acc + l.amount, 0);
  const unallocated = total - sumLines;
  const isOverBudget = unallocated < 0;
  const isUnallocated = unallocated > 0;

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

      {/* Stacked Horizontal Bar of Categories with 2px cream gap */}
      <section aria-labelledby="stacked-bar-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="stacked-bar-heading" className="font-serif text-lg font-bold text-ink">
            Category Breakdown
          </h2>
          <span className="text-ink/65 text-xs">12 Engine Categories</span>
        </div>

        {/* Stacked Bar (Pure CSS with 2px cream gap, aria-hidden) */}
        <div
          className="flex h-6 w-full overflow-hidden rounded-control bg-bg p-0.5"
          style={{ gap: '2px' }}
          aria-hidden="true"
        >
          {lines.map((line) => {
            const percentWidth = Math.max(0, line.percent);
            const color = CATEGORY_COLORS[line.id] || 'var(--cat-misc)';
            if (percentWidth <= 0) return null;

            return (
              <div
                key={line.id}
                style={{
                  width: `${percentWidth}%`,
                  backgroundColor: color,
                }}
                className="h-full rounded-sm transition-all duration-200"
                title={`${line.label}: ${formatInr(line.amount)} (${line.percent}%)`}
              />
            );
          })}
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {lines.map((line) => {
            const color = CATEGORY_COLORS[line.id] || 'var(--cat-misc)';
            return (
              <div
                key={line.id}
                className="border-surface-border/50 flex items-center gap-2 rounded-control border bg-surface p-1.5"
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-sm"
                  style={{ backgroundColor: color }}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{line.label}</p>
                  <p className="text-ink/65 tabular-nums">
                    {line.percent}% • {formatInr(line.amount)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Authoritative Accessible Table */}
      <section aria-labelledby="table-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 id="table-heading" className="font-serif text-xl font-bold text-ink">
            Authoritative Category Allocations
          </h2>
          <span className="text-ink/60 text-xs">Click edit to override any row</span>
        </div>

        {/* Responsive labelled container for 320px reflow */}
        <div
          aria-label="Budget allocations and overrides table"
          className="w-full overflow-x-auto rounded-card border border-surface-border bg-surface"
        >
          <table className="w-full min-w-[620px] text-left text-sm">
            <caption className="sr-only">
              Authoritative celebration budget allocation, percentages, explanation formulas, and
              user overrides.
            </caption>
            <thead>
              <tr className="bg-bg/60 border-b border-surface-border text-xs font-semibold text-ink">
                <th scope="col" className="px-4 py-3">
                  Category
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Amount
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Share
                </th>
                <th scope="col" className="px-4 py-3">
                  Why this number?
                </th>
                <th scope="col" className="px-4 py-3 text-center">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-surface-border/60 divide-y">
              {lines.map((line) => {
                const isEditing = editingCategoryId === line.id;
                const isOverridden = line.source === 'override';
                const isFormulaOpen = openWhyFormulaId === line.id;

                return (
                  <tr key={line.id} className="hover:bg-bg/30">
                    <th scope="row" className="px-4 py-3 font-medium text-ink">
                      <div className="flex items-center gap-2">
                        <span>{line.label}</span>
                        {isOverridden && (
                          <span className="bg-secondary/15 rounded px-1.5 py-0.5 text-[10px] font-semibold text-secondary">
                            Edited by you
                          </span>
                        )}
                      </div>
                    </th>

                    <td className="px-4 py-3 text-right tabular-nums text-ink">
                      {isEditing ? (
                        <div className="inline-flex items-center justify-end gap-1">
                          <span className="text-ink/60 text-xs">₹</span>
                          <Input
                            ref={overrideInputRef}
                            type="number"
                            min={0}
                            value={overrideInputVal}
                            onChange={(e) => setOverrideInputVal(e.target.value)}
                            className="h-8 w-28 text-right text-xs tabular-nums"
                            aria-label={`Override amount for ${line.label}`}
                          />
                        </div>
                      ) : (
                        <MoneyDisplay amount={line.amount} />
                      )}
                    </td>

                    <td className="text-ink/75 px-4 py-3 text-right tabular-nums">
                      {line.percent}%
                    </td>

                    <td className="text-ink/70 px-4 py-3 text-xs">
                      <div>
                        <button
                          type="button"
                          onClick={() => setOpenWhyFormulaId(isFormulaOpen ? null : line.id)}
                          className="touch-target inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          aria-expanded={isFormulaOpen}
                        >
                          <span>{isFormulaOpen ? 'Hide formula' : 'View formula'}</span>
                          {isFormulaOpen ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                        </button>

                        {isFormulaOpen && (
                          <div className="text-ink/80 mt-1.5 rounded-control bg-bg p-2 text-[11px] leading-relaxed">
                            <p className="font-semibold">{line.explanation.formula}</p>
                            <pre className="text-ink/65 mt-1 overflow-x-auto text-[10px]">
                              {JSON.stringify(line.explanation.inputs, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-center text-xs">
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleSaveOverride(line.id)}
                            className="touch-target hover:bg-secondary/90 flex h-7 w-7 items-center justify-center rounded bg-secondary text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
                            aria-label={`Save override for ${line.label}`}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingCategoryId(null)}
                            className="touch-target flex h-7 w-7 items-center justify-center rounded border border-surface-border text-ink hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            aria-label="Cancel editing"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                          {isOverridden && (
                            <button
                              type="button"
                              onClick={() => handleResetOverride(line.id)}
                              className="touch-target text-ink/70 flex h-7 w-7 items-center justify-center rounded border border-surface-border hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                              title="Reset to engine suggestion"
                              aria-label={`Reset ${line.label} to suggested`}
                            >
                              <RotateCcw className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleStartEdit(line.id, line.amount)}
                          className="touch-target hover:bg-primary/5 rounded px-2.5 py-1 font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}

              {/* Unallocated / Over row only when non-zero */}
              {(isOverBudget || isUnallocated) && (
                <tr className={isOverBudget ? 'bg-danger/10 font-bold' : 'bg-warning/10 font-bold'}>
                  <th scope="row" className="px-4 py-3 text-ink">
                    {isOverBudget ? 'Over Budget Reserve' : 'Unallocated Buffer'}
                  </th>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <MoneyDisplay amount={Math.abs(unallocated)} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {Math.round((Math.abs(unallocated) / total) * 100)}%
                  </td>
                  <td colSpan={2} className="px-4 py-3 text-xs">
                    {isOverBudget
                      ? 'Overrides exceed initial total budget ceiling.'
                      : 'Remaining buffer not allocated to any specific category.'}
                  </td>
                </tr>
              )}

              {/* Totals Row */}
              <tr className="bg-bg/80 border-t-2 border-surface-border font-bold text-ink">
                <th scope="row" className="px-4 py-3.5">
                  Total Celebration Budget
                </th>
                <td className="px-4 py-3.5 text-right text-base tabular-nums">
                  <MoneyDisplay amount={total} />
                </td>
                <td className="px-4 py-3.5 text-right tabular-nums">100%</td>
                <td colSpan={2} className="text-ink/70 px-4 py-3.5 text-xs">
                  {lines.length} categories balanced
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Catering Estimate Card */}
      <section
        aria-labelledby="catering-card-heading"
        className="rounded-card border border-surface-border bg-surface p-6 text-left"
      >
        <div className="border-surface-border/60 flex flex-wrap items-center justify-between gap-3 border-b pb-3">
          <div className="flex items-center gap-2">
            <h2 id="catering-card-heading" className="font-serif text-lg font-bold text-ink">
              Catering Feasibility Analysis
            </h2>
            <StatusChip
              status={catering.status}
              customLabel={
                catering.status === 'ok'
                  ? 'Adequate Budget'
                  : catering.status === 'tight'
                    ? 'Tight Per-Plate'
                    : 'Over Catering Band'
              }
            />
          </div>
          <span className="text-ink/65 text-xs tabular-nums">
            {profile.guestCount} guests • {profile.cityTier.toUpperCase()}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="bg-bg/50 rounded-control p-3">
            <p className="text-ink/65 text-xs">Low Per-Plate Range</p>
            <div className="mt-1 font-bold text-ink">
              <MoneyDisplay amount={catering.low} />
            </div>
          </div>

          <div className="bg-bg/50 rounded-control p-3">
            <p className="text-ink/65 text-xs">Mid Per-Plate Range</p>
            <div className="mt-1 font-bold text-ink">
              <MoneyDisplay amount={catering.mid} />
            </div>
          </div>

          <div className="bg-bg/50 rounded-control p-3">
            <p className="text-ink/65 text-xs">High Per-Plate Range</p>
            <div className="mt-1 font-bold text-ink">
              <MoneyDisplay amount={catering.high} />
            </div>
          </div>
        </div>

        {catering.suggestions && (
          <div className="border-surface-border/60 mt-4 border-t pt-3">
            <p className="text-xs font-semibold text-ink">Engine Recommendations:</p>
            <ul className="text-ink/80 mt-1.5 list-inside list-disc space-y-1 text-xs">
              <li>
                Maximum guest capacity for current catering allocation:{' '}
                {catering.suggestions.maxGuestsForAllocation} guests.
              </li>
              {catering.suggestions.savingsNeeded > 0 && (
                <li>
                  Additional allocation needed to reach mid-tier benchmark:{' '}
                  {formatInr(catering.suggestions.savingsNeeded)}.
                </li>
              )}
              {catering.suggestions.alternativeTier && (
                <li>
                  Recommended alternative tier: {catering.suggestions.alternativeTier.toUpperCase()}
                  .
                </li>
              )}
            </ul>
          </div>
        )}
      </section>

      {/* Category Tips On-Demand Card */}
      <section
        aria-labelledby="category-tips-heading"
        className="rounded-card border border-surface-border bg-surface p-6 text-left"
      >
        <div className="border-surface-border/60 flex flex-wrap items-center justify-between gap-3 border-b pb-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-secondary" aria-hidden="true" />
            <h2 id="category-tips-heading" className="font-serif text-lg font-bold text-ink">
              Category Saving & Negotiation Tips
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {tipsLoading && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleStopTips}
                className="h-8 gap-1.5 text-xs"
              >
                <Square className="h-3 w-3 fill-current" aria-hidden="true" />
                <span>Stop</span>
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fetchTips(!!categoryTips)}
              disabled={tipsLoading}
              className="h-8 gap-1.5 text-xs"
            >
              <RotateCcw className={`h-3 w-3 ${tipsLoading ? 'animate-spin' : ''}`} />
              <span>{categoryTips ? 'Refresh tips' : 'Get tips'}</span>
            </Button>
          </div>
        </div>

        <div className="pt-4">
          {tipsLoading ? (
            <div className="space-y-3" aria-busy="true">
              {isSlowTipsWriting && (
                <div
                  role="status"
                  aria-live="polite"
                  className="border-secondary/30 bg-secondary/10 rounded-control border px-3 py-2 text-xs font-medium text-secondary"
                >
                  Still analyzing cost categories... you can stop and use offline tips
                </div>
              )}
              <div className="bg-surface-border/50 h-4 w-1/4 animate-pulse rounded" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[1, 2].map((i) => (
                  <div key={i} className="bg-bg/50 h-16 animate-pulse rounded p-4" />
                ))}
              </div>
            </div>
          ) : tipsError ? (
            <div className="border-warning/30 bg-warning/5 rounded-control border p-4 text-xs">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <div className="space-y-1">
                  <p className="font-semibold text-warning">{tipsError.message}</p>
                  {tipsError.retryAfterSeconds && (
                    <p className="text-ink/75">
                      Retry recommendation: wait {tipsError.retryAfterSeconds} seconds before
                      requesting fresh tips.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : categoryTips?.data?.tips ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {categoryTips.data.tips.map((item, idx) => {
                  const lineMatch = lines.find((l) => l.id === item.categoryId);
                  return (
                    <div
                      key={idx}
                      className="bg-bg/40 rounded-control border border-surface-border p-4 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-serif text-xs font-bold uppercase tracking-wider text-ink">
                          {lineMatch ? lineMatch.label : item.categoryId}
                        </span>
                      </div>
                      <p className="text-ink/80 mt-1.5 text-xs leading-relaxed">{item.tip}</p>
                    </div>
                  );
                })}
              </div>

              <div className="border-surface-border/60 text-ink/60 flex flex-wrap items-center justify-between border-t pt-3 text-xs">
                <span>
                  Provider:{' '}
                  {categoryTips.meta?.provider === 'jarvis'
                    ? 'Gemma via Jarvis'
                    : categoryTips.meta?.provider === 'gemini'
                      ? 'Google Gemini'
                      : 'Deterministic Template'}
                </span>
                <span>Category advice is guidance. Confirm specifics with your vendors.</span>
              </div>
            </div>
          ) : (
            <p className="text-ink/65 text-xs">
              Click &quot;Get tips&quot; to receive tailored vendor negotiation and cost-saving
              advice for your celebration categories.
            </p>
          )}
        </div>
      </section>

      {/* WHAT-IF Sandbox Panel */}
      <section
        aria-labelledby="whatif-heading"
        className="border-primary/30 rounded-card border-2 bg-surface p-6 text-left"
      >
        <div className="border-surface-border/60 flex flex-wrap items-center justify-between gap-3 border-b pb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-control bg-primary text-white">
              <Sliders className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <h2 id="whatif-heading" className="font-serif text-xl font-bold text-ink">
                What-If Rebalancing Sandbox
              </h2>
              <p className="text-ink/65 text-xs">
                Zero network calls. Test guest counts, dates, and budget shifts locally before
                applying.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDiscardWhatIf}
              className="gap-1 text-xs"
            >
              <span>Discard</span>
            </Button>

            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleApplyWhatIf}
              className="gap-1 text-xs"
            >
              <span>Apply changes</span>
            </Button>
          </div>
        </div>

        {/* Screen Reader Live Region */}
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {liveAnnouncement}
        </div>

        {/* What-If Input Controls */}
        <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Guests Input with Stepper */}
          <div className="space-y-2">
            <label
              htmlFor="whatif-guests"
              className="text-xs font-semibold uppercase tracking-wider text-ink"
            >
              Guest Count
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setWhatIfGuests((prev) => Math.max(1, prev - 25))}
                className="touch-target flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-surface-border bg-bg text-ink hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="Decrease what-if guests by 25"
              >
                <Minus className="h-4 w-4" />
              </button>

              <Input
                id="whatif-guests"
                type="number"
                min={1}
                max={5000}
                value={whatIfGuests}
                onChange={(e) => setWhatIfGuests(parseInt(e.target.value, 10) || 1)}
                className="text-center font-semibold tabular-nums"
              />

              <button
                type="button"
                onClick={() => setWhatIfGuests((prev) => Math.min(5000, prev + 25))}
                className="touch-target flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-surface-border bg-bg text-ink hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="Increase what-if guests by 25"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Budget Input with Stepper (step 50k) */}
          <div className="space-y-2">
            <label
              htmlFor="whatif-budget"
              className="text-xs font-semibold uppercase tracking-wider text-ink"
            >
              Total Budget (₹50,000 Step)
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setWhatIfBudget((prev) => Math.max(10000, prev - 50000))}
                className="touch-target flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-surface-border bg-bg text-ink hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="Decrease what-if budget by ₹50,000"
              >
                <Minus className="h-4 w-4" />
              </button>

              <Input
                id="whatif-budget"
                type="number"
                step={50000}
                min={10000}
                value={whatIfBudget}
                onChange={(e) => setWhatIfBudget(parseInt(e.target.value, 10) || 0)}
                className="text-center font-semibold tabular-nums"
              />

              <button
                type="button"
                onClick={() => setWhatIfBudget((prev) => prev + 50000)}
                className="touch-target flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-surface-border bg-bg text-ink hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="Increase what-if budget by ₹50,000"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <p className="text-ink/65 text-[11px] tabular-nums">
              {formatInr(whatIfBudget)} ({inrSpoken(whatIfBudget)})
            </p>
          </div>

          {/* Event Date Input */}
          <div className="space-y-2">
            <label
              htmlFor="whatif-date"
              className="text-xs font-semibold uppercase tracking-wider text-ink"
            >
              Event Date
            </label>
            <Input
              id="whatif-date"
              type="date"
              min={getTomorrowInIst()}
              value={whatIfDate}
              onChange={(e) => setWhatIfDate(e.target.value)}
              className="h-10"
            />
          </div>
        </div>

        {/* Live Diff Output */}
        {replanOutput && replanOutput.ok && (
          <div className="border-surface-border/60 mt-6 space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
              <span className="text-ink/75 text-xs font-semibold uppercase tracking-wider">
                Computed Rebalance Diffs
              </span>
              <span className="text-xs font-semibold text-secondary">
                Calculated locally via pure TypeScript
              </span>
            </div>

            {/* Diff Chips */}
            <div className="flex flex-wrap gap-2">
              {replanOutput.diff.cateringEstimateDelta !== 0 && (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium tabular-nums ${
                    replanOutput.diff.cateringEstimateDelta > 0
                      ? 'bg-warning/15 border-warning/30 border text-warning'
                      : 'bg-secondary/15 border-secondary/30 border text-secondary'
                  }`}
                >
                  <span>
                    Catering {replanOutput.diff.cateringEstimateDelta > 0 ? '+' : ''}
                    {formatInr(replanOutput.diff.cateringEstimateDelta)}
                  </span>
                </span>
              )}

              {replanOutput.diff.totalDelta !== 0 && (
                <span className="border-primary/30 bg-primary/10 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium tabular-nums text-primary">
                  <span>
                    Total Budget {replanOutput.diff.totalDelta > 0 ? '+' : ''}
                    {formatInr(replanOutput.diff.totalDelta)}
                  </span>
                </span>
              )}

              {replanOutput.diff.milestonesShifted.length > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-surface-border bg-bg px-3 py-1 text-xs font-medium text-ink">
                  <span>
                    {replanOutput.diff.milestonesShifted.length} milestone
                    {replanOutput.diff.milestonesShifted.length > 1 ? 's' : ''} shifted
                  </span>
                </span>
              )}

              {replanOutput.diff.flagsAdded.length > 0 && (
                <span className="border-danger/30 bg-danger/10 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium text-danger">
                  <span>New heads-up: catering over</span>
                </span>
              )}
            </div>

            {/* diff.summaryFacts */}
            {replanOutput.diff.summaryFacts.length > 0 && (
              <div className="bg-bg/60 rounded-control p-3 text-xs">
                <p className="font-semibold text-ink">Engine Replan Summary:</p>
                <ul className="text-ink/80 mt-1 list-inside list-disc space-y-0.5">
                  {replanOutput.diff.summaryFacts.map((fact, idx) => (
                    <li key={idx}>{fact}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Assumptions Dialog */}
      <Dialog open={isAssumptionsOpen} onOpenChange={setIsAssumptionsOpen}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Engine Planning Assumptions</DialogTitle>
            <DialogDescription>
              Deterministic allocation baselines derived from Indian event data.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2 text-left">
            <div className="bg-bg/50 text-ink/80 rounded-control border border-surface-border p-3 text-xs">
              <span className="font-semibold text-ink">Honest note:</span> Typical estimates from
              public sources, not vendor quotes. Always get 3 quotes from local service providers.
            </div>

            <div className="divide-surface-border/60 divide-y">
              {plan.assumptions.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 text-xs">
                  <div>
                    <span className="font-semibold text-ink">{item.label}</span>
                    <span className="bg-surface-border/50 text-ink/70 ml-2 rounded px-1.5 py-0.5 text-[10px] uppercase">
                      {item.source}
                    </span>
                  </div>
                  <span className="text-ink/90 font-medium tabular-nums">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
