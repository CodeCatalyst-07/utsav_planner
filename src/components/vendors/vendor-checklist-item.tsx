'use client';

import * as React from 'react';
import {
  ExternalLink,
  MapPin,
  ChevronDown,
  ChevronUp,
  UtensilsCrossed,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { StatusChip } from '@/components/ui/status-chip';
import { MoneyDisplay } from '@/components/ui/money-display';
import { ChecklistItem } from '@/domain/rules/checklist';
import { VendorsApiResponse } from '@/lib/client-fetch';

interface VendorChecklistItemProps {
  item: ChecklistItem;
  isBooked: boolean;
  onToggleBooked: (id: string) => void;
  today: string;
  linkedAmount?: number;
  isExpanded: boolean;
  isLoading: boolean;
  error?: string;
  listings?: VendorsApiResponse;
  onToggleExpand: (item: ChecklistItem) => void;
  onOpenMenu: () => void;
}

export function VendorChecklistItem({
  item,
  isBooked,
  onToggleBooked,
  today,
  linkedAmount,
  isExpanded,
  isLoading,
  error,
  listings,
  onToggleExpand,
  onOpenMenu,
}: VendorChecklistItemProps) {
  const isCatererRow = item.id === 'caterer' || item.budgetCategory === 'catering';
  const isDoNow = item.dueDate <= today;
  const mapsSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    item.mapsQuery
  )}`;

  return (
    <div
      className={`border-surface-border/60 border-b p-4 transition-colors last:border-0 sm:p-5 ${
        isBooked ? 'bg-bg/40' : 'bg-surface'
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        {/* Checkbox and Title */}
        <div className="flex items-start gap-3">
          <div className="pt-0.5">
            <Checkbox
              checked={isBooked}
              onCheckedChange={() => onToggleBooked(item.id)}
              aria-label={`Mark ${item.label} as booked`}
            />
          </div>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`font-serif text-base font-bold ${
                  isBooked ? 'text-ink/60 line-through' : 'text-ink'
                }`}
              >
                {item.label}
              </span>

              <StatusChip
                status={item.priority === 'high' ? 'tight' : 'ok'}
                customLabel={
                  item.priority === 'high'
                    ? 'High Priority'
                    : item.priority === 'medium'
                      ? 'Medium Priority'
                      : 'Low Priority'
                }
                size="sm"
              />

              {isDoNow ? (
                <span className="border-warning/30 bg-warning/15 rounded border px-2 py-0.5 text-xs font-semibold text-warning">
                  Do now
                </span>
              ) : (
                <span className="text-ink/65 text-xs tabular-nums">
                  Book by {item.dueDate} ({item.leadDays} days before)
                </span>
              )}
            </div>

            {item.note && <p className="text-ink/75 text-xs leading-relaxed">{item.note}</p>}

            {linkedAmount !== undefined && (
              <p className="text-ink/65 text-xs tabular-nums">
                Allocated budget band: <MoneyDisplay amount={linkedAmount} />
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
          {isCatererRow && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenMenu}
              className="h-8 gap-1.5 text-xs text-secondary hover:text-secondary"
            >
              <UtensilsCrossed className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Menu ideas</span>
            </Button>
          )}

          <a
            href={mapsSearchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="touch-target inline-flex h-8 items-center gap-1.5 rounded-control border border-surface-border bg-bg px-2.5 text-xs font-medium text-ink hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            <span>Find on Maps</span>
            <ExternalLink className="text-ink/60 h-3 w-3" aria-hidden="true" />
          </a>

          <button
            type="button"
            onClick={() => onToggleExpand(item)}
            aria-expanded={isExpanded}
            className="touch-target inline-flex h-8 items-center gap-1 rounded-control border border-surface-border bg-bg px-2.5 text-xs font-medium text-ink hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span>{isExpanded ? 'Hide listings' : 'Show listings'}</span>
            {isExpanded ? (
              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Expandable Example Listings Container */}
      {isExpanded && (
        <div className="border-surface-border/80 bg-bg/50 mt-4 rounded-control border p-4">
          {/* Prominent Sample Disclaimer */}
          <div className="border-warning/30 bg-warning/10 mb-3 flex items-start gap-2 rounded border p-2.5 text-xs text-warning">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
            <span>
              <strong>Sample listings disclaimer:</strong> Sample listing, not a real business. Use
              the Google Maps link above to find verified local vendors.
            </span>
          </div>

          {isLoading ? (
            <div className="space-y-3" aria-busy="true">
              <div className="bg-surface-border/50 h-4 w-1/4 animate-pulse rounded" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-20 animate-pulse rounded border border-surface-border bg-surface"
                  />
                ))}
              </div>
            </div>
          ) : error ? (
            <div className="border-danger/30 bg-danger/10 rounded border p-3 text-xs text-danger">
              {error}
            </div>
          ) : listings && listings.vendors.length > 0 ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {listings.vendors.map((vendor) => (
                  <div
                    key={vendor.id}
                    className="flex flex-col justify-between rounded-control border border-surface-border bg-surface p-3.5 text-left"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-serif text-sm font-bold text-ink">{vendor.name}</h3>
                        <span className="bg-surface-border/50 text-ink/70 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                          {vendor.badge === 'sample' ? 'Sample' : 'Google Maps'}
                        </span>
                      </div>
                      {vendor.area && (
                        <p className="text-ink/70 mt-1 text-xs">Area: {vendor.area}</p>
                      )}
                      {vendor.note && (
                        <p className="text-ink/60 mt-1 text-[11px] leading-relaxed">
                          {vendor.note}
                        </p>
                      )}
                    </div>

                    <div className="border-surface-border/50 mt-3 border-t pt-2">
                      <a
                        href={vendor.mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                      >
                        <span>View on Maps</span>
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-ink/70 text-xs">No example listings found for this category.</p>
          )}
        </div>
      )}
    </div>
  );
}
