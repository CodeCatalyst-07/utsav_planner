'use client';

import * as React from 'react';
import { Minus, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { WizardFormData } from './wizard-types';
import { BudgetTier } from '@/domain/schemas/profile';
import { formatInr, inrSpoken } from '@/domain/money/inr';

export interface Step3GuestsBudgetProps {
  formData: WizardFormData;
  setFormData: React.Dispatch<React.SetStateAction<WizardFormData>>;
  errors: Record<string, string>;
  stepHeadingRef?: React.RefObject<HTMLHeadingElement | null>;
}

export function Step3GuestsBudget({
  formData,
  setFormData,
  errors,
  stepHeadingRef,
}: Step3GuestsBudgetProps) {
  return (
    <section aria-labelledby="step-heading" className="space-y-6 text-left">
      <header className="space-y-1">
        <h1
          id="step-heading"
          ref={stepHeadingRef}
          tabIndex={-1}
          className="font-serif text-2xl font-bold tracking-tight text-ink focus:outline-none sm:text-3xl"
        >
          How many guests, and what is your overall budget?
        </h1>
        <p className="text-ink/75 text-sm sm:text-base">
          The engine balances per-head catering ranges against your total budget ceiling.
        </p>
      </header>

      <div className="space-y-6 rounded-card border border-surface-border bg-surface p-6">
        {/* Guest Count with steppers */}
        <div className="space-y-2">
          <Label htmlFor="field-guestCount" className="text-sm font-semibold text-ink">
            Guest Count <span className="text-danger">*</span>
          </Label>
          <div className="flex max-w-xs items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setFormData((prev) => ({
                  ...prev,
                  guestCount: Math.max(1, prev.guestCount - 25),
                }))
              }
              className="touch-target flex h-11 w-11 items-center justify-center rounded-control border border-surface-border bg-surface text-ink hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Decrease guest count by 25"
            >
              <Minus className="h-4 w-4" />
            </button>

            <Input
              id="field-guestCount"
              type="number"
              min={1}
              max={5000}
              value={formData.guestCount}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  guestCount: parseInt(e.target.value, 10) || 0,
                }))
              }
              aria-invalid={Boolean(errors['guestCount'])}
              aria-describedby={errors['guestCount'] ? 'field-guestCount-error' : undefined}
              className="text-center font-semibold tabular-nums"
            />

            <button
              type="button"
              onClick={() =>
                setFormData((prev) => ({
                  ...prev,
                  guestCount: Math.min(5000, prev.guestCount + 25),
                }))
              }
              className="touch-target flex h-11 w-11 items-center justify-center rounded-control border border-surface-border bg-surface text-ink hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Increase guest count by 25"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          {errors['guestCount'] && (
            <p id="field-guestCount-error" className="text-xs font-semibold text-danger">
              {errors['guestCount']}
            </p>
          )}
        </div>

        {/* Total Budget with steppers */}
        <div className="border-surface-border/60 space-y-2 border-t pt-4">
          <Label htmlFor="field-totalBudgetInr" className="text-sm font-semibold text-ink">
            Total Celebration Budget (₹) <span className="text-danger">*</span>
          </Label>
          <div className="flex max-w-md items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setFormData((prev) => ({
                  ...prev,
                  totalBudgetInr: Math.max(10000, prev.totalBudgetInr - 50000),
                }))
              }
              className="touch-target flex h-11 w-11 shrink-0 items-center justify-center rounded-control border border-surface-border bg-surface text-ink hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Decrease budget by ₹50,000"
            >
              <Minus className="h-4 w-4" />
            </button>

            <Input
              id="field-totalBudgetInr"
              type="number"
              step={50000}
              min={10000}
              value={formData.totalBudgetInr}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  totalBudgetInr: parseInt(e.target.value, 10) || 0,
                }))
              }
              aria-invalid={Boolean(errors['totalBudgetInr'])}
              aria-describedby={
                errors['totalBudgetInr'] ? 'field-totalBudgetInr-error' : 'budget-spoken-display'
              }
              className="font-semibold tabular-nums"
            />

            <button
              type="button"
              onClick={() =>
                setFormData((prev) => ({
                  ...prev,
                  totalBudgetInr: prev.totalBudgetInr + 50000,
                }))
              }
              className="touch-target flex h-11 w-11 shrink-0 items-center justify-center rounded-control border border-surface-border bg-surface text-ink hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Increase budget by ₹50,000"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div
            id="budget-spoken-display"
            className="mt-1 flex items-center gap-2 text-xs text-secondary"
          >
            <span className="font-semibold tabular-nums">{formatInr(formData.totalBudgetInr)}</span>
            <span className="text-ink/75">({inrSpoken(formData.totalBudgetInr)})</span>
          </div>

          {errors['totalBudgetInr'] && (
            <p id="field-totalBudgetInr-error" className="text-xs font-semibold text-danger">
              {errors['totalBudgetInr']}
            </p>
          )}
        </div>

        {/* Budget Tier */}
        <div className="border-surface-border/60 space-y-2 border-t pt-4">
          <Label htmlFor="field-budgetTier" className="text-sm font-semibold text-ink">
            Planning Tier <span className="text-danger">*</span>
          </Label>
          <select
            id="field-budgetTier"
            value={formData.budgetTier}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, budgetTier: e.target.value as BudgetTier }))
            }
            className="touch-target flex h-11 w-full max-w-md rounded-control border border-surface-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
          >
            <option value="budget">
              Value / Budget (Efficient spending, standard vendor packages)
            </option>
            <option value="mid">
              Mid-Range / Classic (Curated catering, customary floral mandap)
            </option>
            <option value="premium">
              Premium / Luxury (High-touch styling, bespoke menus, top decorators)
            </option>
          </select>
        </div>
      </div>
    </section>
  );
}
