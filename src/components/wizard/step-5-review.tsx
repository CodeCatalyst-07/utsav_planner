'use client';

import * as React from 'react';
import { DecorativeMotif } from '@/components/ui/decorative-motif';
import { WizardFormData } from './wizard-types';
import { formatInr, inrSpoken } from '@/domain/money/inr';

export interface Step5ReviewProps {
  formData: WizardFormData;
  setStep: (step: number) => void;
  isCompleted: boolean;
  stepHeadingRef?: React.RefObject<HTMLHeadingElement | null>;
}

export function Step5Review({ formData, setStep, isCompleted, stepHeadingRef }: Step5ReviewProps) {
  return (
    <section aria-labelledby="step-heading" className="space-y-6 text-left">
      <header className="space-y-1">
        <h1
          id="step-heading"
          ref={stepHeadingRef}
          tabIndex={-1}
          className="font-serif text-2xl font-bold tracking-tight text-ink focus:outline-none sm:text-3xl"
        >
          Review Your Celebration Blueprint
        </h1>
        <p className="text-ink/75 text-sm sm:text-base">
          Confirm your preferences before initializing the local deterministic calculation.
        </p>
      </header>

      <div className="space-y-4 rounded-card border border-surface-border bg-surface p-6">
        {/* Section 1: Type */}
        <div className="border-surface-border/60 flex items-center justify-between border-b pb-3">
          <div>
            <p className="text-ink/60 text-xs uppercase tracking-wider">Celebration Type</p>
            <p className="font-serif text-base font-bold text-ink">
              {formData.eventType === 'wedding'
                ? 'Indian Wedding'
                : formData.eventType === 'birthday_kids'
                  ? 'Kids Birthday Party'
                  : formData.eventType === 'birthday_adult'
                    ? 'Adult / Milestone Birthday'
                    : 'Community Festival'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setStep(1)}
            className="touch-target text-xs font-semibold text-primary hover:underline"
          >
            Edit
          </button>
        </div>

        {/* Section 2: Date & City */}
        <div className="border-surface-border/60 flex items-center justify-between border-b pb-3">
          <div>
            <p className="text-ink/60 text-xs uppercase tracking-wider">Date & Location</p>
            <p className="text-sm font-semibold text-ink">
              {formData.eventDate} • {formData.cityName} ({formData.cityTier.toUpperCase()})
            </p>
          </div>
          <button
            type="button"
            onClick={() => setStep(2)}
            className="touch-target text-xs font-semibold text-primary hover:underline"
          >
            Edit
          </button>
        </div>

        {/* Section 3: Guests & Budget */}
        <div className="border-surface-border/60 flex items-center justify-between border-b pb-3">
          <div>
            <p className="text-ink/60 text-xs uppercase tracking-wider">Scale & Budget</p>
            <p className="text-sm font-semibold text-ink">
              {formData.guestCount} guests • {formatInr(formData.totalBudgetInr)} (
              {inrSpoken(formData.totalBudgetInr)})
            </p>
            <p className="text-xs capitalize text-secondary">{formData.budgetTier} tier pricing</p>
          </div>
          <button
            type="button"
            onClick={() => setStep(3)}
            className="touch-target text-xs font-semibold text-primary hover:underline"
          >
            Edit
          </button>
        </div>

        {/* Section 4: Details */}
        <div className="flex items-center justify-between pb-1">
          <div>
            <p className="text-ink/60 text-xs uppercase tracking-wider">Setup & Dietary</p>
            <p className="text-sm text-ink">
              Venue: <span className="font-semibold capitalize">{formData.venueType}</span>
              {formData.eventType === 'wedding' && ` • ${formData.functionsCount} functions`}
            </p>
            <p className="text-ink/70 text-xs">
              Veg: {formData.dietary.veg}, Non-Veg: {formData.dietary.nonVeg}, Jain:{' '}
              {formData.dietary.jain}, Vegan: {formData.dietary.vegan}
            </p>
            {formData.notes && (
              <p className="text-ink/80 mt-1 text-xs italic">&ldquo;{formData.notes}&rdquo;</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setStep(4)}
            className="touch-target text-xs font-semibold text-primary hover:underline"
          >
            Edit
          </button>
        </div>
      </div>

      {/* Completion decorative motif moment */}
      {isCompleted && (
        <div
          className="border-accent/40 bg-accent/5 flex items-center justify-center gap-3 rounded-card border p-4"
          role="status"
          aria-live="polite"
        >
          <DecorativeMotif size={36} className="text-accent" />
          <p className="text-sm font-semibold text-ink">
            Generating blueprint with zero-network engine...
          </p>
        </div>
      )}
    </section>
  );
}
