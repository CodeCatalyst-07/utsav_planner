'use client';

import * as React from 'react';
import { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Store,
  ExternalLink,
  MapPin,
  ChevronDown,
  ChevronUp,
  UtensilsCrossed,
  Square,
  RotateCw,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { StatusChip } from '@/components/ui/status-chip';
import { MoneyDisplay } from '@/components/ui/money-display';
import { usePlan } from '@/context/plan-context';
import { ChecklistItem } from '@/domain/rules/checklist';
import {
  fetchVendors,
  fetchAiMenu,
  VendorsApiResponse,
  MenuResponse,
  ClientApiError,
} from '@/lib/client-fetch';
import { buildMenuCacheKey } from '@/lib/hash';

// Module-level in-memory cache for vendor listings during the session
const vendorListingCache = new Map<string, VendorsApiResponse>();

export default function VendorsPage() {
  const { profile, plan, today, bookedVendors, toggleVendor, loadSample } = usePlan();

  // Expanded listing rows state: Record<itemId, boolean>
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  // Loading state for vendor listings: Record<itemId, boolean>
  const [listingsLoading, setListingsLoading] = useState<Record<string, boolean>>({});
  // Errors for vendor listings: Record<itemId, string>
  const [listingsError, setListingsError] = useState<Record<string, string>>({});
  // Loaded listings data: Record<itemId, VendorsApiResponse>
  const [listingsData, setListingsData] = useState<Record<string, VendorsApiResponse>>({});

  // Active fetch abort controllers for collapsible vendor listings
  const abortControllersRef = useRef<Record<string, AbortController>>({});

  // On-demand Menu Ideas modal / panel state
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuData, setMenuData] = useState<MenuResponse | null>(null);
  const [menuLoading, setMenuLoading] = useState(false);
  const [isSlowMenuWriting, setIsSlowMenuWriting] = useState(false);
  const [menuError, setMenuError] = useState<ClientApiError | null>(null);
  const menuAbortControllerRef = useRef<AbortController | null>(null);
  const menuSlowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up in-flight controllers on unmount
  useEffect(() => {
    const controllers = abortControllersRef.current;
    const menuController = menuAbortControllerRef.current;
    const slowTimer = menuSlowTimerRef.current;

    return () => {
      Object.values(controllers).forEach((c) => c.abort());
      menuController?.abort();
      if (slowTimer) clearTimeout(slowTimer);
    };
  }, []);

  // Compute map of budgetCategory to amount for quick lookup
  const budgetByCategory = useMemo(() => {
    const map = new Map<string, number>();
    if (plan) {
      for (const line of plan.budget.lines) {
        map.set(line.id, line.amount);
      }
    }
    return map;
  }, [plan]);

  // Group checklist items by priority
  const groupedItems = useMemo(() => {
    if (!plan) return { high: [], medium: [], low: [] };
    const high: ChecklistItem[] = [];
    const medium: ChecklistItem[] = [];
    const low: ChecklistItem[] = [];

    for (const item of plan.checklist.items) {
      if (item.priority === 'high') {
        high.push(item);
      } else if (item.priority === 'medium') {
        medium.push(item);
      } else {
        low.push(item);
      }
    }

    return { high, medium, low };
  }, [plan]);

  const handleToggleExpand = async (item: ChecklistItem) => {
    const isCurrentlyExpanded = !!expandedRows[item.id];

    if (isCurrentlyExpanded) {
      // Collapse and abort any in-flight fetch
      if (abortControllersRef.current[item.id]) {
        abortControllersRef.current[item.id]?.abort();
        delete abortControllersRef.current[item.id];
      }
      setExpandedRows((prev) => ({ ...prev, [item.id]: false }));
      setListingsLoading((prev) => ({ ...prev, [item.id]: false }));
      return;
    }

    // Expand
    setExpandedRows((prev) => ({ ...prev, [item.id]: true }));

    // Check in-memory cache first
    const cacheKey = `${item.budgetCategory}:${profile?.cityName || ''}:${profile?.cityTier || ''}:${item.label}`;
    if (vendorListingCache.has(cacheKey)) {
      setListingsData((prev) => ({ ...prev, [item.id]: vendorListingCache.get(cacheKey)! }));
      return;
    }

    // Fetch from API
    const controller = new AbortController();
    abortControllersRef.current[item.id] = controller;
    setListingsLoading((prev) => ({ ...prev, [item.id]: true }));
    setListingsError((prev) => ({ ...prev, [item.id]: '' }));

    const res = await fetchVendors(
      {
        categoryId: item.budgetCategory,
        city: profile?.cityName,
        tier: profile?.cityTier,
        label: item.label,
      },
      controller.signal
    );

    delete abortControllersRef.current[item.id];
    setListingsLoading((prev) => ({ ...prev, [item.id]: false }));

    if (res.ok) {
      vendorListingCache.set(cacheKey, res.data);
      setListingsData((prev) => ({ ...prev, [item.id]: res.data }));
    } else {
      if (res.error.code !== 'ABORTED') {
        setListingsError((prev) => ({ ...prev, [item.id]: res.error.message }));
      }
    }
  };

  const fetchMenuSuggestions = async (forceRefresh = false) => {
    if (!profile) return;

    const cacheKey = buildMenuCacheKey({
      eventType: profile.eventType,
      cityName: profile.cityName || '',
      guestCount: profile.guestCount,
      dietary: profile.dietary,
    });

    if (!forceRefresh) {
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          setMenuData(JSON.parse(cached));
          setMenuLoading(false);
          setMenuError(null);
          setIsMenuOpen(true);
          return;
        }
      } catch {}
    }

    if (menuAbortControllerRef.current) {
      menuAbortControllerRef.current.abort();
    }

    const controller = new AbortController();
    menuAbortControllerRef.current = controller;

    if (menuSlowTimerRef.current) clearTimeout(menuSlowTimerRef.current);
    setIsSlowMenuWriting(false);
    menuSlowTimerRef.current = setTimeout(() => {
      setIsSlowMenuWriting(true);
    }, 6000);

    setMenuLoading(true);
    setMenuError(null);
    setIsMenuOpen(true);

    const res = await fetchAiMenu(profile, controller.signal);

    if (menuSlowTimerRef.current) clearTimeout(menuSlowTimerRef.current);
    setIsSlowMenuWriting(false);

    if (res.ok) {
      setMenuData(res.data);
      setMenuLoading(false);
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify(res.data));
      } catch {}
    } else {
      setMenuLoading(false);
      setMenuError(res.error);
    }
  };

  const handleStopMenuGeneration = () => {
    if (menuSlowTimerRef.current) clearTimeout(menuSlowTimerRef.current);
    setIsSlowMenuWriting(false);
    if (menuAbortControllerRef.current) {
      menuAbortControllerRef.current.abort();
      menuAbortControllerRef.current = null;
    }
    setMenuLoading(false);
    setMenuError({
      isError: true,
      code: 'ABORTED',
      message: 'Menu idea generation was stopped by user.',
    });
  };

  if (!profile || !plan) {
    return (
      <div className="w-full space-y-6 text-left">
        <header className="border-b border-surface-border pb-4">
          <div className="inline-flex items-center gap-2 rounded-control border border-surface-border bg-surface px-3 py-1 text-xs font-semibold uppercase tracking-wider text-secondary">
            <Store className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Curated Checklists</span>
          </div>
          <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight text-ink">
            Vendor Checklist
          </h1>
          <p className="text-ink/75 mt-1 text-sm sm:text-base">
            Role-by-role coordinator checklists and vendor lookup via Sample data or Google Maps.
          </p>
        </header>

        <section
          aria-labelledby="vendors-empty-heading"
          className="space-y-6 rounded-card border border-surface-border bg-surface p-8 sm:p-12"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-control bg-bg text-primary">
            <Store className="h-6 w-6" aria-hidden="true" />
          </div>

          <div className="max-w-xl space-y-2">
            <h2 id="vendors-empty-heading" className="font-serif text-2xl font-bold text-ink">
              No vendor checklist configured yet
            </h2>
            <p className="text-ink/80 text-sm leading-relaxed sm:text-base">
              Set up your celebration details to generate prioritized vendor checklists, booking
              lead times, and sample directory listings.
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

  const allItems = plan.checklist.items;
  const totalCount = allItems.length;
  const bookedCount = allItems.filter((i) => bookedVendors.includes(i.id)).length;
  const progressPercent = totalCount > 0 ? Math.round((bookedCount / totalCount) * 100) : 0;

  const renderItemRow = (item: ChecklistItem) => {
    const isBooked = bookedVendors.includes(item.id);
    const isExpanded = !!expandedRows[item.id];
    const isLoading = !!listingsLoading[item.id];
    const error = listingsError[item.id];
    const listings = listingsData[item.id];
    const linkedAmount = budgetByCategory.get(item.budgetCategory);
    const isCatererRow = item.id === 'caterer' || item.budgetCategory === 'catering';

    const isDoNow = item.dueDate <= today;
    const mapsSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      item.mapsQuery
    )}`;

    return (
      <div
        key={item.id}
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
                onCheckedChange={() => toggleVendor(item.id)}
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
                onClick={() => fetchMenuSuggestions(false)}
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
              onClick={() => handleToggleExpand(item)}
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
                <strong>Sample listings disclaimer:</strong> Sample listing, not a real business.
                Use the Google Maps link above to find verified local vendors.
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
  };

  return (
    <div className="w-full space-y-8 text-left">
      {/* Header */}
      <header className="flex flex-col justify-between gap-4 border-b border-surface-border pb-5 sm:flex-row sm:items-center">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-secondary">
            Vendor Directory & Checklists
          </span>
          <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Vendor Checklist
          </h1>
          <p className="text-ink/75 text-xs sm:text-sm">
            {profile.cityName} ({profile.cityTier.toUpperCase()}) • {totalCount} coordinator
            deliverables
          </p>
        </div>

        {/* Booking Progress Indicator */}
        <div className="min-w-[200px] rounded-card border border-surface-border bg-surface p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-ink">Booking Progress</span>
            <span className="font-bold tabular-nums text-primary">
              {bookedCount} of {totalCount} booked
            </span>
          </div>

          <div
            role="progressbar"
            aria-valuenow={bookedCount}
            aria-valuemin={0}
            aria-valuemax={totalCount}
            aria-label="Vendor booking completion progress"
            className="mt-2 h-2 w-full overflow-hidden rounded-full bg-bg"
          >
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </header>

      {/* High Priority Group */}
      {groupedItems.high.length > 0 && (
        <section aria-labelledby="high-priority-heading" className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-danger" aria-hidden="true" />
            <h2 id="high-priority-heading" className="font-serif text-xl font-bold text-ink">
              High Priority Deliverables
            </h2>
            <span className="text-ink/65 text-xs">({groupedItems.high.length} items)</span>
          </div>

          <div className="overflow-hidden rounded-card border border-surface-border bg-surface">
            {groupedItems.high.map(renderItemRow)}
          </div>
        </section>
      )}

      {/* Medium Priority Group */}
      {groupedItems.medium.length > 0 && (
        <section aria-labelledby="medium-priority-heading" className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-secondary" aria-hidden="true" />
            <h2 id="medium-priority-heading" className="font-serif text-xl font-bold text-ink">
              Medium Priority Deliverables
            </h2>
            <span className="text-ink/65 text-xs">({groupedItems.medium.length} items)</span>
          </div>

          <div className="overflow-hidden rounded-card border border-surface-border bg-surface">
            {groupedItems.medium.map(renderItemRow)}
          </div>
        </section>
      )}

      {/* Low Priority Group */}
      {groupedItems.low.length > 0 && (
        <section aria-labelledby="low-priority-heading" className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-surface-border" aria-hidden="true" />
            <h2 id="low-priority-heading" className="font-serif text-xl font-bold text-ink">
              Low Priority & Miscellaneous
            </h2>
            <span className="text-ink/65 text-xs">({groupedItems.low.length} items)</span>
          </div>

          <div className="overflow-hidden rounded-card border border-surface-border bg-surface">
            {groupedItems.low.map(renderItemRow)}
          </div>
        </section>
      )}

      {/* On-Demand Menu Ideas Modal / Panel */}
      {isMenuOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="menu-ideas-heading"
          className="backdrop-blur-xs fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-card border border-surface-border bg-surface p-6 text-left shadow-lg">
            <div className="flex items-center justify-between border-b border-surface-border pb-4">
              <div className="flex items-center gap-2">
                <UtensilsCrossed className="h-5 w-5 text-secondary" aria-hidden="true" />
                <h3 id="menu-ideas-heading" className="font-serif text-xl font-bold text-ink">
                  Celebration Menu Ideas
                </h3>
              </div>

              <div className="flex items-center gap-2">
                {menuLoading && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleStopMenuGeneration}
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
                  onClick={() => fetchMenuSuggestions(true)}
                  disabled={menuLoading}
                  className="h-8 gap-1.5 text-xs"
                >
                  <RotateCw className={`h-3 w-3 ${menuLoading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsMenuOpen(false)}
                  className="text-ink/70 h-8 text-xs"
                >
                  Close
                </Button>
              </div>
            </div>

            <div className="pt-4">
              {menuLoading ? (
                <div className="space-y-4" aria-busy="true">
                  {isSlowMenuWriting && (
                    <div
                      role="status"
                      aria-live="polite"
                      className="border-secondary/30 bg-secondary/10 rounded-control border px-3 py-2 text-xs font-medium text-secondary"
                    >
                      Still composing menu courses... you can stop and use offline suggestions
                    </div>
                  )}
                  <div className="bg-surface-border/50 h-4 w-1/3 animate-pulse rounded" />
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="bg-bg/50 h-16 animate-pulse rounded p-4" />
                    ))}
                  </div>
                </div>
              ) : menuError ? (
                <div className="border-warning/30 bg-warning/5 rounded-control border p-4 text-xs">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                    <div className="space-y-1">
                      <p className="font-semibold text-warning">{menuError.message}</p>
                      {menuError.retryAfterSeconds && (
                        <p className="text-ink/75">
                          Retry recommendation: wait {menuError.retryAfterSeconds} seconds before
                          requesting fresh menu suggestions.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : menuData?.data?.suggestions ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {menuData.data.suggestions.map((course, idx) => (
                      <div
                        key={idx}
                        className="bg-bg/40 rounded-control border border-surface-border p-4"
                      >
                        <h4 className="font-serif text-sm font-bold text-ink">{course.course}</h4>
                        <ul className="text-ink/80 mt-2 list-inside list-disc space-y-1 text-xs">
                          {course.items.map((item, itemIdx) => (
                            <li key={itemIdx}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>

                  <div className="border-surface-border/60 text-ink/60 flex flex-wrap items-center justify-between border-t pt-3 text-xs">
                    <span>
                      Provider:{' '}
                      {menuData.meta?.provider === 'jarvis'
                        ? 'Gemma via Jarvis'
                        : menuData.meta?.provider === 'gemini'
                          ? 'Google Gemini'
                          : 'Deterministic Template'}
                    </span>
                    <span>
                      Menu ideas are suggestions. Confirm allergens and prep with your caterer.
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
