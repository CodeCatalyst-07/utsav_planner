'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { WizardFormData } from './wizard-types';
import { CityTier } from '@/domain/schemas/profile';

export interface Step2DateCityProps {
  formData: WizardFormData;
  setFormData: React.Dispatch<React.SetStateAction<WizardFormData>>;
  errors: Record<string, string>;
  minDate: string;
  stepHeadingRef?: React.RefObject<HTMLHeadingElement | null>;
}

export function Step2DateCity({
  formData,
  setFormData,
  errors,
  minDate,
  stepHeadingRef,
}: Step2DateCityProps) {
  return (
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
  );
}
