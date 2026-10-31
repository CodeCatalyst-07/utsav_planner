'use client';

import * as React from 'react';
import { Suspense, useState, useEffect, useRef, useId } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Sparkles,
  Cake,
  Users,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Minus,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DecorativeMotif } from '@/components/ui/decorative-motif';
import { usePlan } from '@/context/plan-context';
import {
  EventType,
  CityTier,
  BudgetTier,
  VenueType,
  EventProfile,
  validateProfile,
} from '@/domain/schemas/profile';
import { formatInr, inrSpoken } from '@/domain/money/inr';
import { getTomorrowInIst, getTodayInIst } from '@/lib/today';
import { addDays } from '@/domain/dates';

interface WizardFormData {
  eventType: EventType;
  birthdayKind: 'kids' | 'adult';
  eventDate: string;
  cityName: string;
  cityTier: CityTier;
  guestCount: number;
  totalBudgetInr: number;
  budgetTier: BudgetTier;
  venueType: VenueType;
  functionsCount: number;
  dietary: {
    veg: number;
    nonVeg: number;
    jain: number;
    vegan: number;
  };
  toggles: {
    venueIncluded: boolean;
    includeAttireJewellery: boolean;
  };
  notes: string;
}

const DEFAULT_WIZARD_DATA: WizardFormData = {
  eventType: 'wedding',
  birthdayKind: 'adult',
  eventDate: '',
  cityName: '',
  cityTier: 'tier1',
  guestCount: 200,
  totalBudgetInr: 2500000,
  budgetTier: 'mid',
  venueType: 'lawn',
  functionsCount: 2,
  dietary: {
    veg: 160,
    nonVeg: 30,
    jain: 10,
    vegan: 0,
  },
  toggles: {
    venueIncluded: false,
    includeAttireJewellery: true,
  },
  notes: '',
};

const STEP_TITLES = [
  'Event Type',
  'Date & City',
  'Guests & Budget',
  'Event Details',
  'Review & Confirm',
];

function WizardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile: savedProfile, setProfile } = usePlan();

  const minDate = getTomorrowInIst();
  const today = getTodayInIst();

  const [step, setStep] = useState<number>(1);
  const [formData, setFormData] = useState<WizardFormData>(() => {
    // If query param type specified
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

    setTimeout(() => {
      router.push('/plan');
    }, 400);
  };

  return (
    <div className="w-full space-y-8">
      {/* Stepper Navigation */}
      <nav
        aria-label="Wizard Steps Progress"
        className="w-full border-b border-surface-border pb-4"
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-secondary">
            Step {step} of 5 — {STEP_TITLES[step - 1]}
          </p>
          <span className="text-ink/60 text-xs">Auto-saved draft</span>
        </div>

        <ol className="mt-3 flex items-center justify-between gap-2">
          {STEP_TITLES.map((title, idx) => {
            const stepNum = idx + 1;
            const isCurrent = step === stepNum;
            const isDone = step > stepNum;

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
        <section aria-labelledby="step-heading" className="space-y-6 text-left">
          <header className="space-y-1">
            <h1
              id="step-heading"
              ref={stepHeadingRef}
              tabIndex={-1}
              className="font-serif text-2xl font-bold tracking-tight text-ink focus:outline-none sm:text-3xl"
            >
              What type of celebration are you planning?
            </h1>
            <p className="text-ink/75 text-sm sm:text-base">
              Each event type uses tailored Indian budget allocation splits and ritual lead times.
            </p>
          </header>

          <fieldset className="space-y-4">
            <legend className="sr-only">Select Event Type</legend>

            {/* Wedding Card */}
            <div
              className={`flex items-start gap-4 rounded-card border p-5 transition-colors ${
                formData.eventType === 'wedding'
                  ? 'border-primary bg-surface ring-1 ring-primary'
                  : 'hover:border-surface-border/80 border-surface-border bg-surface'
              }`}
            >
              <input
                type="radio"
                id="radio-wedding"
                name="eventType"
                value="wedding"
                checked={formData.eventType === 'wedding'}
                onChange={() =>
                  setFormData((prev) => ({
                    ...prev,
                    eventType: 'wedding',
                    venueType: 'lawn',
                    functionsCount: 2,
                    totalBudgetInr: Math.max(prev.totalBudgetInr, 1500000),
                  }))
                }
                className="mt-1 h-4 w-4 text-primary focus:ring-primary"
              />
              <label htmlFor="radio-wedding" className="cursor-pointer space-y-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
                  <span className="font-semibold text-ink">Indian Wedding</span>
                </div>
                <p className="text-ink/70 text-xs sm:text-sm">
                  Pheras, Sangeet, Mehendi, reception dinner, decor mandap, and cultural rituals.
                </p>
              </label>
            </div>

            {/* Birthday Card */}
            <div
              className={`space-y-3 rounded-card border p-5 transition-colors ${
                formData.eventType === 'birthday_kids' || formData.eventType === 'birthday_adult'
                  ? 'border-primary bg-surface ring-1 ring-primary'
                  : 'hover:border-surface-border/80 border-surface-border bg-surface'
              }`}
            >
              <div className="flex items-start gap-4">
                <input
                  type="radio"
                  name="eventType"
                  id="radio-birthday"
                  checked={
                    formData.eventType === 'birthday_kids' ||
                    formData.eventType === 'birthday_adult'
                  }
                  onChange={() =>
                    setFormData((prev) => ({
                      ...prev,
                      eventType: prev.birthdayKind === 'kids' ? 'birthday_kids' : 'birthday_adult',
                      functionsCount: 1,
                    }))
                  }
                  className="mt-1 h-4 w-4 text-primary focus:ring-primary"
                />
                <label htmlFor="radio-birthday" className="cursor-pointer space-y-1">
                  <div className="flex items-center gap-2">
                    <Cake className="h-4 w-4 text-primary" aria-hidden="true" />
                    <span className="font-semibold text-ink">Birthday Celebration</span>
                  </div>
                  <p className="text-ink/70 text-xs sm:text-sm">
                    Children’s themed party or adult milestone jubilee with games, dinner & decor.
                  </p>
                </label>
              </div>

              {(formData.eventType === 'birthday_kids' ||
                formData.eventType === 'birthday_adult') && (
                <div className="border-surface-border/60 ml-8 border-t pt-3">
                  <span className="text-xs font-semibold text-ink">Select birthday format:</span>
                  <div className="mt-2 flex flex-wrap gap-4">
                    <label
                      htmlFor="birthday-kind-kids"
                      className="flex cursor-pointer items-center gap-2 text-xs font-medium text-ink"
                    >
                      <input
                        type="radio"
                        id="birthday-kind-kids"
                        name="birthdayKind"
                        value="kids"
                        checked={formData.eventType === 'birthday_kids'}
                        onChange={() =>
                          setFormData((prev) => ({
                            ...prev,
                            eventType: 'birthday_kids',
                            birthdayKind: 'kids',
                            guestCount: 40,
                            totalBudgetInr: 100000,
                            venueType: 'home',
                          }))
                        }
                        className="text-primary focus:ring-primary"
                      />
                      <span>Kids birthday party (play area / home)</span>
                    </label>

                    <label
                      htmlFor="birthday-kind-adult"
                      className="flex cursor-pointer items-center gap-2 text-xs font-medium text-ink"
                    >
                      <input
                        type="radio"
                        id="birthday-kind-adult"
                        name="birthdayKind"
                        value="adult"
                        checked={formData.eventType === 'birthday_adult'}
                        onChange={() =>
                          setFormData((prev) => ({
                            ...prev,
                            eventType: 'birthday_adult',
                            birthdayKind: 'adult',
                            guestCount: 60,
                            totalBudgetInr: 250000,
                            venueType: 'banquet',
                          }))
                        }
                        className="text-primary focus:ring-primary"
                      />
                      <span>Adult / milestone birthday (jubilee dinner / DJ)</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Community Festival Card */}
            <div
              className={`flex items-start gap-4 rounded-card border p-5 transition-colors ${
                formData.eventType === 'community_festival'
                  ? 'border-primary bg-surface ring-1 ring-primary'
                  : 'hover:border-surface-border/80 border-surface-border bg-surface'
              }`}
            >
              <input
                type="radio"
                id="radio-community"
                name="eventType"
                value="community_festival"
                checked={formData.eventType === 'community_festival'}
                onChange={() =>
                  setFormData((prev) => ({
                    ...prev,
                    eventType: 'community_festival',
                    venueType: 'community_hall',
                    functionsCount: 1,
                    guestCount: 500,
                    totalBudgetInr: 400000,
                  }))
                }
                className="mt-1 h-4 w-4 text-primary focus:ring-primary"
              />
              <label htmlFor="radio-community" className="cursor-pointer space-y-1">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" aria-hidden="true" />
                  <span className="font-semibold text-ink">Community Festival</span>
                </div>
                <p className="text-ink/70 text-xs sm:text-sm">
                  Diwali mela, Ganesh Utsav, Durga Puja pandal, cultural stage, and public safety.
                </p>
              </label>
            </div>
          </fieldset>
        </section>
      )}

      {/* STEP 2: Date + City */}
      {step === 2 && (
        <section aria-labelledby="step-heading" className="space-y-6 text-left">
          <header className="space-y-1">
            <h1
              id="step-heading"
              ref={stepHeadingRef}
              tabIndex={-1}
              className="font-serif text-2xl font-bold tracking-tight text-ink focus:outline-none sm:text-3xl"
            >
              When and where is the celebration?
            </h1>
            <p className="text-ink/75 text-sm sm:text-base">
              Dates drive milestone lead times. City tier calibrates authentic vendor cost bands.
            </p>
          </header>

          <div className="space-y-5 rounded-card border border-surface-border bg-surface p-6">
            {/* Event Date Input */}
            <div className="space-y-2">
              <Label htmlFor="field-eventDate" className="text-sm font-semibold text-ink">
                Celebration Date <span className="text-danger">*</span>
              </Label>
              <Input
                id="field-eventDate"
                type="date"
                min={minDate}
                value={formData.eventDate}
                onChange={(e) => setFormData((prev) => ({ ...prev, eventDate: e.target.value }))}
                aria-invalid={Boolean(errors['eventDate'])}
                aria-describedby={errors['eventDate'] ? 'field-eventDate-error' : 'date-helper'}
                className="max-w-md"
              />
              <p id="date-helper" className="text-ink/65 text-xs">
                Minimum date is tomorrow ({minDate}). Indian weddings typically plan 6–12 months in
                advance.
              </p>
              {errors['eventDate'] && (
                <p id="field-eventDate-error" className="text-xs font-semibold text-danger">
                  {errors['eventDate']}
                </p>
              )}
            </div>

            {/* City Name */}
            <div className="space-y-2">
              <Label htmlFor="field-cityName" className="text-sm font-semibold text-ink">
                City / Location <span className="text-danger">*</span>
              </Label>
              <Input
                id="field-cityName"
                type="text"
                placeholder="e.g. Pune, Delhi, Mumbai, Bengaluru, Jaipur"
                value={formData.cityName}
                onChange={(e) => setFormData((prev) => ({ ...prev, cityName: e.target.value }))}
                aria-invalid={Boolean(errors['cityName'])}
                aria-describedby={errors['cityName'] ? 'field-cityName-error' : undefined}
                className="max-w-md"
              />
              {errors['cityName'] && (
                <p id="field-cityName-error" className="text-xs font-semibold text-danger">
                  {errors['cityName']}
                </p>
              )}
            </div>

            {/* City Tier */}
            <div className="space-y-2">
              <Label htmlFor="field-cityTier" className="text-sm font-semibold text-ink">
                City Tier <span className="text-danger">*</span>
              </Label>
              <select
                id="field-cityTier"
                value={formData.cityTier}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, cityTier: e.target.value as CityTier }))
                }
                className="touch-target flex h-11 w-full max-w-md rounded-control border border-surface-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
              >
                <option value="tier1">
                  Tier 1 (Metro: Mumbai, Delhi NCR, Bengaluru, Chennai, Hyderabad, Kolkata, Pune)
                </option>
                <option value="tier2">
                  Tier 2 (Hub: Jaipur, Ahmedabad, Lucknow, Chandigarh, Indore, Kochi, Surat)
                </option>
                <option value="tier3">Tier 3 (Regional / District / Destination Towns)</option>
              </select>
              <p className="text-ink/65 text-xs">
                Tier 1 metros have higher baseline per-plate catering and venue booking deposits.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* STEP 3: Guests + Budget */}
      {step === 3 && (
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
                    errors['totalBudgetInr']
                      ? 'field-totalBudgetInr-error'
                      : 'budget-spoken-display'
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

              {/* Spoken and formatted live currency reading */}
              <div
                id="budget-spoken-display"
                className="mt-1 flex items-center gap-2 text-xs text-secondary"
              >
                <span className="font-semibold tabular-nums">
                  {formatInr(formData.totalBudgetInr)}
                </span>
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
      )}

      {/* STEP 4: Details */}
      {step === 4 && (
        <section aria-labelledby="step-heading" className="space-y-6 text-left">
          <header className="space-y-1">
            <h1
              id="step-heading"
              ref={stepHeadingRef}
              tabIndex={-1}
              className="font-serif text-2xl font-bold tracking-tight text-ink focus:outline-none sm:text-3xl"
            >
              Celebration Details & Dietary Preferences
            </h1>
            <p className="text-ink/75 text-sm sm:text-base">
              Fine-tune venue style, wedding ceremony count, and meal allocations.
            </p>
          </header>

          <div className="space-y-6 rounded-card border border-surface-border bg-surface p-6">
            {/* Venue Type */}
            <div className="space-y-2">
              <Label htmlFor="field-venueType" className="text-sm font-semibold text-ink">
                Venue Type
              </Label>
              <select
                id="field-venueType"
                value={formData.venueType}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, venueType: e.target.value as VenueType }))
                }
                className="touch-target flex h-11 w-full max-w-md rounded-control border border-surface-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
              >
                <option value="banquet">Banquet Hall (Indoor air-conditioned)</option>
                <option value="lawn">Open Lawn / Farmhouse</option>
                <option value="hotel">Hotel Ballroom</option>
                <option value="resort">Resort & Heritage Palace</option>
                <option value="community_hall">Community / Society Hall</option>
                <option value="home">Home / Private Residence</option>
              </select>
            </div>

            {/* Functions Count (for weddings) */}
            {formData.eventType === 'wedding' && (
              <div className="border-surface-border/60 space-y-2 border-t pt-4">
                <Label htmlFor="field-functionsCount" className="text-sm font-semibold text-ink">
                  Number of Wedding Functions (1 to 6)
                </Label>
                <Input
                  id="field-functionsCount"
                  type="number"
                  min={1}
                  max={6}
                  value={formData.functionsCount}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      functionsCount: parseInt(e.target.value, 10) || 1,
                    }))
                  }
                  className="max-w-xs tabular-nums"
                />
                <p className="text-ink/65 text-xs">
                  e.g. 1 (Pheras & dinner only), 2 (Sangeet + Wedding), 3+ (Mehendi, Haldi, Sangeet,
                  Pheras, Reception).
                </p>
                {errors['functionsCount'] && (
                  <p className="text-xs font-semibold text-danger">{errors['functionsCount']}</p>
                )}
              </div>
            )}

            {/* Dietary Preference breakdown */}
            <div className="border-surface-border/60 space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold text-ink">Dietary Breakdown</Label>
                <span
                  className={`text-xs font-semibold tabular-nums ${
                    assignedDietaryCount > formData.guestCount
                      ? 'text-danger'
                      : assignedDietaryCount === formData.guestCount
                        ? 'text-secondary'
                        : 'text-ink/75'
                  }`}
                >
                  {assignedDietaryCount} of {formData.guestCount} guests assigned
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <Label htmlFor="dietary-veg" className="text-ink/80 text-xs font-medium">
                    Vegetarian
                  </Label>
                  <Input
                    id="dietary-veg"
                    type="number"
                    min={0}
                    value={formData.dietary.veg}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        dietary: { ...prev.dietary, veg: parseInt(e.target.value, 10) || 0 },
                      }))
                    }
                    className="mt-1 tabular-nums"
                  />
                </div>

                <div>
                  <Label htmlFor="dietary-nonveg" className="text-ink/80 text-xs font-medium">
                    Non-Vegetarian
                  </Label>
                  <Input
                    id="dietary-nonveg"
                    type="number"
                    min={0}
                    value={formData.dietary.nonVeg}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        dietary: { ...prev.dietary, nonVeg: parseInt(e.target.value, 10) || 0 },
                      }))
                    }
                    className="mt-1 tabular-nums"
                  />
                </div>

                <div>
                  <Label htmlFor="dietary-jain" className="text-ink/80 text-xs font-medium">
                    Jain
                  </Label>
                  <Input
                    id="dietary-jain"
                    type="number"
                    min={0}
                    value={formData.dietary.jain}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        dietary: { ...prev.dietary, jain: parseInt(e.target.value, 10) || 0 },
                      }))
                    }
                    className="mt-1 tabular-nums"
                  />
                </div>

                <div>
                  <Label htmlFor="dietary-vegan" className="text-ink/80 text-xs font-medium">
                    Vegan
                  </Label>
                  <Input
                    id="dietary-vegan"
                    type="number"
                    min={0}
                    value={formData.dietary.vegan}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        dietary: { ...prev.dietary, vegan: parseInt(e.target.value, 10) || 0 },
                      }))
                    }
                    className="mt-1 tabular-nums"
                  />
                </div>
              </div>
              {errors['dietary'] && (
                <p className="text-xs font-semibold text-danger">{errors['dietary']}</p>
              )}
            </div>

            {/* Toggles */}
            <div className="border-surface-border/60 space-y-3 border-t pt-4">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="toggle-venue-included"
                  checked={formData.toggles.venueIncluded}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      toggles: { ...prev.toggles, venueIncluded: e.target.checked },
                    }))
                  }
                  className="mt-1 h-4 w-4 rounded-control text-primary focus:ring-primary"
                />
                <label htmlFor="toggle-venue-included" className="cursor-pointer space-y-0.5">
                  <span className="block text-sm font-semibold text-ink">
                    Venue Already Arranged
                  </span>
                  <p className="text-ink/70 text-xs">
                    Check this if you are using an ancestral home, pre-booked lawn, or club house at
                    zero extra rental.
                  </p>
                </label>
              </div>

              {formData.eventType === 'wedding' && (
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="toggle-attire-jewellery"
                    checked={formData.toggles.includeAttireJewellery}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        toggles: { ...prev.toggles, includeAttireJewellery: e.target.checked },
                      }))
                    }
                    className="mt-1 h-4 w-4 rounded-control text-primary focus:ring-primary"
                  />
                  <label htmlFor="toggle-attire-jewellery" className="cursor-pointer space-y-0.5">
                    <span className="block text-sm font-semibold text-ink">
                      Include Bridal Attire & Jewellery Split
                    </span>
                    <p className="text-ink/70 text-xs">
                      Reserves ~18% of wedding budget for bride/groom styling, outfits, and
                      accessories.
                    </p>
                  </label>
                </div>
              )}
            </div>

            {/* Notes textarea with 500-char counter and privacy warning */}
            <div className="border-surface-border/60 space-y-2 border-t pt-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="field-notes" className="text-sm font-semibold text-ink">
                  Special Notes & Vibe (Optional)
                </Label>
                <span className="text-ink/60 text-xs tabular-nums">
                  {formData.notes.length}/500 chars
                </span>
              </div>
              <textarea
                id="field-notes"
                maxLength={500}
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Colors, vibe, must-haves. Please do not include phone numbers or personal data."
                className="placeholder:text-ink/40 w-full rounded-control border border-surface-border bg-surface p-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
              />
              <p className="text-ink/60 text-xs">
                Colors, vibe, must-haves. Please do not include phone numbers or personal data.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* STEP 5: Review */}
      {step === 5 && (
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
                <p className="text-xs capitalize text-secondary">
                  {formData.budgetTier} tier pricing
                </p>
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
