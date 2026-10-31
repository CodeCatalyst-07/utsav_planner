'use client';

import * as React from 'react';
import { Sparkles, Cake, Users } from 'lucide-react';
import { WizardFormData } from './wizard-types';

export interface Step1EventProps {
  formData: WizardFormData;
  setFormData: React.Dispatch<React.SetStateAction<WizardFormData>>;
  stepHeadingRef?: React.RefObject<HTMLHeadingElement | null>;
}

export function Step1Event({ formData, setFormData, stepHeadingRef }: Step1EventProps) {
  return (
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
                formData.eventType === 'birthday_kids' || formData.eventType === 'birthday_adult'
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

          {(formData.eventType === 'birthday_kids' || formData.eventType === 'birthday_adult') && (
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
  );
}
