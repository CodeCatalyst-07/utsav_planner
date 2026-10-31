'use client';

import * as React from 'react';
import { Suspense, useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, ArrowLeft, CheckCircle2, AlertTriangle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePlan } from '@/context/plan-context';
import { EventProfile, validateProfile } from '@/domain/schemas/profile';
import { getTomorrowInIst, getTodayInIst } from '@/lib/today';
import { addDays } from '@/domain/dates';
import { WizardFormData, DEFAULT_WIZARD_DATA, STEP_TITLES } from '@/components/wizard/wizard-types';
import { Step1Event } from '@/components/wizard/step-1-event';
import { Step2DateCity } from '@/components/wizard/step-2-date-city';
import { Step3GuestsBudget } from '@/components/wizard/step-3-guests-budget';
import { Step4Details } from '@/components/wizard/step-4-details';
import { Step5Review } from '@/components/wizard/step-5-review';

function WizardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile: savedProfile, setProfile } = usePlan();

  const minDate = getTomorrowInIst();
  const today = getTodayInIst();

  const [step, setStep] = useState<number>(1);
  const [formData, setFormData] = useState<WizardFormData>(() => {
    const qType = searchParams.get('type');
    const isEdit = searchParams.get('edit') === '1';

    if (isEdit && savedProfile) {
      return {
        eventType: savedProfile.eventType,
        birthdayKind: savedProfile.eventType === 'birthday_kids' ? 'kids' : 'adult',
        eventDate: savedProfile.eventDate,
        cityName: savedProfile.cityName || '',
        cityTier: savedProfile.cityTier,
        guestCount: savedProfile.guestCount,
        totalBudgetInr: savedProfile.totalBudgetInr,
        budgetTier: savedProfile.budgetTier,
        venueType: savedProfile.venueType,
        functionsCount: savedProfile.functionsCount || 1,
        dietary: { ...savedProfile.dietary },
        toggles: { ...savedProfile.toggles },
        notes: savedProfile.notes || '',
      };
    }

    if (qType === 'birthday_kids') {
      return {
        ...DEFAULT_WIZARD_DATA,
        eventType: 'birthday_kids',
        birthdayKind: 'kids',
        guestCount: 40,
        totalBudgetInr: 100000,
        venueType: 'home',
        functionsCount: 1,
      };
    }
    if (qType === 'birthday_adult') {
      return {
        ...DEFAULT_WIZARD_DATA,
        eventType: 'birthday_adult',
        birthdayKind: 'adult',
        guestCount: 60,
        totalBudgetInr: 250000,
        venueType: 'banquet',
        functionsCount: 1,
      };
    }
    if (qType === 'community_festival') {
      return {
        ...DEFAULT_WIZARD_DATA,
        eventType: 'community_festival',
        guestCount: 500,
        totalBudgetInr: 500000,
        venueType: 'community_hall',
        functionsCount: 1,
      };
    }

    return {
      ...DEFAULT_WIZARD_DATA,
      eventDate: addDays(today, 240),
    };
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  // Focus management on step change
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    stepHeadingRef.current?.focus();
  }, [step]);

  // Set default event date once hydrated if empty
  useEffect(() => {
    if (!formData.eventDate) {
      setFormData((prev) => ({
        ...prev,
        eventDate: addDays(today, 180),
      }));
    }
  }, [today, formData.eventDate]);

  // Autosave draft
  useEffect(() => {
    try {
      sessionStorage.setItem('utsav_wizard_draft', JSON.stringify(formData));
    } catch {
      // ignore
    }
  }, [formData]);

  const assignedDietaryCount =
    formData.dietary.veg + formData.dietary.nonVeg + formData.dietary.jain + formData.dietary.vegan;

  const validateCurrentStep = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!formData.eventType) {
        newErrors['eventType'] = 'Please select an event type.';
      }
    } else if (step === 2) {
      if (!formData.eventDate) {
        newErrors['eventDate'] = 'Event date is required.';
      } else if (formData.eventDate < minDate) {
        newErrors['eventDate'] = `Event date must be from tomorrow (${minDate}) onwards.`;
      }
      if (!formData.cityName.trim()) {
        newErrors['cityName'] = 'City name is required.';
      }
    } else if (step === 3) {
      if (formData.guestCount < 1) {
        newErrors['guestCount'] = 'Guest count must be at least 1.';
      } else if (formData.guestCount > 5000) {
        newErrors['guestCount'] = 'Guest count cannot exceed 5,000.';
      }
      if (formData.totalBudgetInr < 10000) {
        newErrors['totalBudgetInr'] = 'Total budget must be at least ₹10,000.';
      }
    } else if (step === 4) {
      if (formData.eventType === 'wedding') {
        if (formData.functionsCount < 1 || formData.functionsCount > 6) {
          newErrors['functionsCount'] = 'Wedding functions count must be between 1 and 6.';
        }
      }
      if (assignedDietaryCount > formData.guestCount) {
        newErrors['dietary'] =
          `Dietary assigned (${assignedDietaryCount}) exceeds total guests (${formData.guestCount}).`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateCurrentStep()) {
      setErrors({});
      setStep((prev) => Math.min(prev + 1, 5));
    }
  };

  const handleBack = () => {
    setErrors({});
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const handleComplete = () => {
    const finalProfile: EventProfile = {
      eventType: formData.eventType,
      eventDate: formData.eventDate,
      cityName: formData.cityName.trim(),
      cityTier: formData.cityTier,
      guestCount: formData.guestCount,
      totalBudgetInr: formData.totalBudgetInr,
      budgetTier: formData.budgetTier,
      venueType: formData.venueType,
      functionsCount: formData.eventType === 'wedding' ? formData.functionsCount : 1,
      dietary: { ...formData.dietary },
      toggles: { ...formData.toggles },
      overrides: savedProfile?.overrides || {},
      notes: formData.notes.trim() || undefined,
    };

    const valResult = validateProfile(finalProfile, today);
    if (!valResult.ok) {
      const errMap: Record<string, string> = {};
      valResult.errors.forEach((e) => {
        errMap[e.path] = e.message;
      });
      setErrors(errMap);
      return;
    }

    setIsCompleted(true);
    setProfile(valResult.data);
    router.push('/plan');
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {/* 5-Step Stepper Header */}
      <nav aria-label="Wizard Steps Progress" className="w-full">
        <ol className="flex items-center justify-between gap-2">
          {STEP_TITLES.map((title, idx) => {
            const stepNum = idx + 1;
            const isDone = stepNum < step;
            const isCurrent = stepNum === step;

            return (
              <li
                key={title}
                className="flex flex-1 items-center gap-2"
                aria-current={isCurrent ? 'step' : undefined}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-xs font-bold transition-colors ${
                    isCurrent
                      ? 'bg-primary text-white ring-2 ring-primary ring-offset-2'
                      : isDone
                        ? 'bg-secondary text-white'
                        : 'text-ink/60 border border-surface-border bg-surface'
                  }`}
                >
                  {isDone ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : stepNum}
                </div>
                <span className="hidden text-xs font-medium text-ink md:inline">{title}</span>
                {stepNum < 5 && (
                  <div
                    className={`h-0.5 flex-1 transition-colors ${
                      isDone ? 'bg-secondary' : 'bg-surface-border'
                    }`}
                    aria-hidden="true"
                  />
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Error Summary Banner (if errors) */}
      {Object.keys(errors).length > 0 && (
        <section
          aria-labelledby="error-summary-heading"
          className="border-danger/40 bg-danger/5 rounded-card border p-4 text-left"
          role="alert"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden="true" />
            <div>
              <h2 id="error-summary-heading" className="text-sm font-semibold text-danger">
                Please resolve the following before continuing:
              </h2>
              <ul className="text-danger/90 mt-2 list-inside list-disc space-y-1 text-xs">
                {Object.entries(errors).map(([field, msg]) => (
                  <li key={field}>
                    <a href={`#field-${field}`} className="underline hover:text-danger">
                      {msg}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* STEP 1: Event Type */}
      {step === 1 && (
        <Step1Event formData={formData} setFormData={setFormData} stepHeadingRef={stepHeadingRef} />
      )}

      {/* STEP 2: Date + City */}
      {step === 2 && (
        <Step2DateCity
          formData={formData}
          setFormData={setFormData}
          errors={errors}
          minDate={minDate}
          stepHeadingRef={stepHeadingRef}
        />
      )}

      {/* STEP 3: Guests + Budget */}
      {step === 3 && (
        <Step3GuestsBudget
          formData={formData}
          setFormData={setFormData}
          errors={errors}
          stepHeadingRef={stepHeadingRef}
        />
      )}

      {/* STEP 4: Details & Dietary Preferences */}
      {step === 4 && (
        <Step4Details
          formData={formData}
          setFormData={setFormData}
          errors={errors}
          stepHeadingRef={stepHeadingRef}
        />
      )}

      {/* STEP 5: Review & Confirm */}
      {step === 5 && (
        <Step5Review
          formData={formData}
          setStep={setStep}
          isCompleted={isCompleted}
          stepHeadingRef={stepHeadingRef}
        />
      )}

      {/* Persistent Navigation Buttons */}
      <div className="flex items-center justify-between border-t border-surface-border pt-5">
        {step > 1 ? (
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
            className="touch-target gap-2"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Back</span>
          </Button>
        ) : (
          <Button asChild variant="ghost" className="touch-target">
            <Link href="/">Cancel</Link>
          </Button>
        )}

        {step < 5 ? (
          <Button
            type="button"
            variant="primary"
            onClick={handleNext}
            className="touch-target gap-2"
          >
            <span>Continue</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        ) : (
          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={handleComplete}
            disabled={isCompleted}
            className="touch-target gap-2"
          >
            <span>Create my plan</span>
            <Sparkles className="h-4 w-4 text-white" aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  );
}

export default function WizardPage() {
  return (
    <Suspense
      fallback={
        <div className="text-ink/60 space-y-4 p-8 text-center">
          <p>Loading celebration wizard...</p>
        </div>
      }
    >
      <WizardContent />
    </Suspense>
  );
}
