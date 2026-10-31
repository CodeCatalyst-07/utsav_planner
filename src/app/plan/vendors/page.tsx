'use client';

import * as React from 'react';
import { useState, useRef, useEffect, useMemo } from 'react';
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
import { VendorsEmptyState } from '@/components/vendors/vendors-empty-state';
import { MenuIdeasModal } from '@/components/vendors/menu-ideas-modal';
import { VendorChecklistItem } from '@/components/vendors/vendor-checklist-item';

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
    return <VendorsEmptyState onLoadSample={loadSample} />;
  }

  const allItems = plan.checklist.items;
  const totalCount = allItems.length;
  const bookedCount = allItems.filter((i) => bookedVendors.includes(i.id)).length;
  const progressPercent = totalCount > 0 ? Math.round((bookedCount / totalCount) * 100) : 0;

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
            {groupedItems.high.map((item) => (
              <VendorChecklistItem
                key={item.id}
                item={item}
                isBooked={bookedVendors.includes(item.id)}
                onToggleBooked={toggleVendor}
                today={today}
                linkedAmount={budgetByCategory.get(item.budgetCategory)}
                isExpanded={!!expandedRows[item.id]}
                isLoading={!!listingsLoading[item.id]}
                error={listingsError[item.id]}
                listings={listingsData[item.id]}
                onToggleExpand={handleToggleExpand}
                onOpenMenu={() => fetchMenuSuggestions(false)}
              />
            ))}
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
            {groupedItems.medium.map((item) => (
              <VendorChecklistItem
                key={item.id}
                item={item}
                isBooked={bookedVendors.includes(item.id)}
                onToggleBooked={toggleVendor}
                today={today}
                linkedAmount={budgetByCategory.get(item.budgetCategory)}
                isExpanded={!!expandedRows[item.id]}
                isLoading={!!listingsLoading[item.id]}
                error={listingsError[item.id]}
                listings={listingsData[item.id]}
                onToggleExpand={handleToggleExpand}
                onOpenMenu={() => fetchMenuSuggestions(false)}
              />
            ))}
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
            {groupedItems.low.map((item) => (
              <VendorChecklistItem
                key={item.id}
                item={item}
                isBooked={bookedVendors.includes(item.id)}
                onToggleBooked={toggleVendor}
                today={today}
                linkedAmount={budgetByCategory.get(item.budgetCategory)}
                isExpanded={!!expandedRows[item.id]}
                isLoading={!!listingsLoading[item.id]}
                error={listingsError[item.id]}
                listings={listingsData[item.id]}
                onToggleExpand={handleToggleExpand}
                onOpenMenu={() => fetchMenuSuggestions(false)}
              />
            ))}
          </div>
        </section>
      )}

      {/* On-Demand Menu Ideas Modal */}
      <MenuIdeasModal
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        menuLoading={menuLoading}
        isSlowMenuWriting={isSlowMenuWriting}
        menuError={menuError}
        menuData={menuData}
        onRefresh={() => fetchMenuSuggestions(true)}
        onStop={handleStopMenuGeneration}
      />
    </div>
  );
}
