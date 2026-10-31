'use client';

import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { WizardFormData } from './wizard-types';
import { VenueType } from '@/domain/schemas/profile';
import { containsPii } from '@/lib/pii';

export interface Step4DetailsProps {
  formData: WizardFormData;
  setFormData: React.Dispatch<React.SetStateAction<WizardFormData>>;
  errors: Record<string, string>;
  stepHeadingRef?: React.RefObject<HTMLHeadingElement | null>;
}

export function Step4Details({ formData, setFormData, errors, stepHeadingRef }: Step4DetailsProps) {
  const assignedDietaryCount =
    formData.dietary.veg + formData.dietary.nonVeg + formData.dietary.jain + formData.dietary.vegan;

  const hasPii = containsPii(formData.notes);

  return (
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
              <span className="block text-sm font-semibold text-ink">Venue Already Arranged</span>
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
                  Reserves ~18% of wedding budget for bride/groom styling, outfits, and accessories.
                </p>
              </label>
            </div>
          )}
        </div>

        {/* Notes textarea with 500-char counter and non-blocking PII warning */}
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

          {hasPii && (
            <div
              role="status"
              className="flex items-center gap-2 rounded-control border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-300"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>
                Privacy Notice: Contact details (phone number / email) detected. They will be
                automatically redacted as [removed] before processing.
              </span>
            </div>
          )}

          <p className="text-ink/60 text-xs">
            Colors, vibe, must-haves. Please do not include phone numbers or personal data.
          </p>
        </div>
      </div>
    </section>
  );
}
