'use client';

import * as React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Trash2, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/ui/status-chip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { usePlan } from '@/context/plan-context';
import { fetchAiIdeas, IdeasResponse, ClientApiError } from '@/lib/client-fetch';
import { buildIdeasCacheKey } from '@/lib/hash';
import { PlanEmptyState, PlanSkeleton } from '@/components/plan/plan-empty-state';
import { PlanStatBlocks } from '@/components/plan/plan-stat-blocks';
import { IdeasCard } from '@/components/plan/ideas-card';
import { PlanSidebar } from '@/components/plan/plan-sidebar';

export default function PlanHomePage() {
  const router = useRouter();
  const { profile, plan, isHydrated, loadSample, reset } = usePlan();

  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);

  // AI Ideas state
  const [ideas, setIdeas] = useState<IdeasResponse | null>(null);
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [isSlowWriting, setIsSlowWriting] = useState(false);
  const [ideasError, setIdeasError] = useState<ClientApiError | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Trigger AI Ideas fetch when profile changes or on refresh
  const fetchIdeas = useCallback(
    async (forceRefresh = false) => {
      if (!profile) return;

      const cacheKey = buildIdeasCacheKey({
        eventType: profile.eventType,
        cityName: profile.cityName || '',
        guestCount: profile.guestCount,
        budgetTier: profile.budgetTier,
        notes: profile.notes,
      });

      if (!forceRefresh) {
        try {
          const cached = sessionStorage.getItem(cacheKey);
          if (cached) {
            setIdeas(JSON.parse(cached));
            setIdeasLoading(false);
            setIdeasError(null);
            return;
          }
        } catch {
          // ignore cache read error
        }
      }

      // Abort previous in-flight request if any
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
      setIsSlowWriting(false);
      slowTimerRef.current = setTimeout(() => {
        setIsSlowWriting(true);
      }, 6000);

      setIdeasLoading(true);
      setIdeasError(null);

      const res = await fetchAiIdeas(profile, controller.signal);

      if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
      setIsSlowWriting(false);

      if (res.ok) {
        setIdeas(res.data);
        setIdeasLoading(false);
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(res.data));
        } catch {
          // ignore cache write error
        }
      } else {
        setIdeasLoading(false);
        setIdeasError(res.error);
      }
    },
    [profile]
  );

  useEffect(() => {
    if (profile) {
      fetchIdeas(false);
    }
    return () => {
      if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
      abortControllerRef.current?.abort();
    };
  }, [profile, fetchIdeas]);

  const handleStopGeneration = () => {
    if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
    setIsSlowWriting(false);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIdeasLoading(false);
    setIdeasError({
      isError: true,
      code: 'ABORTED',
      message: 'Idea generation was stopped by user.',
    });
  };

  const handleConfirmClear = () => {
    reset();
    setIsClearDialogOpen(false);
    try {
      sessionStorage.clear();
    } catch {}
    router.push('/');
  };

  // SSR Skeleton
  if (!isHydrated) {
    return <PlanSkeleton />;
  }

  // Empty State
  if (!profile || !plan) {
    return <PlanEmptyState onLoadSample={loadSample} />;
  }

  // Active Plan View
  const eventLabel =
    profile.eventType === 'wedding'
      ? 'Indian Wedding'
      : profile.eventType === 'birthday_kids'
        ? 'Kids Birthday'
        : profile.eventType === 'birthday_adult'
          ? 'Milestone Birthday'
          : 'Community Festival';

  return (
    <div className="w-full space-y-8 text-left">
      {/* Header */}
      <header className="flex flex-col justify-between gap-4 border-b border-surface-border pb-5 sm:flex-row sm:items-center">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-secondary">
            Active Blueprint
          </span>
          <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            {eventLabel} in {profile.cityName}
          </h1>
          <p className="text-ink/75 text-xs sm:text-sm">
            {profile.eventDate} • {profile.guestCount} guests • {profile.cityTier.toUpperCase()}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
            <Link href="/plan/new?edit=1">
              <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Edit details</span>
            </Link>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsClearDialogOpen(true)}
            className="hover:bg-danger/10 gap-1.5 text-xs text-danger hover:text-danger"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Clear my data</span>
          </Button>
        </div>
      </header>

      {/* Privacy Note */}
      <div className="text-ink/75 rounded-control border border-surface-border bg-surface px-4 py-2.5 text-xs">
        <span className="font-semibold text-ink">Privacy guaranteed:</span> Your celebration details
        are stored only in your browser. We never create accounts or store your profile on our
        servers.
      </div>

      {/* 4 Stat Blocks */}
      <PlanStatBlocks plan={plan} />

      {/* 12-Column Grid Layout */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Main Column (8 cols) */}
        <div className="space-y-8 lg:col-span-8">
          {/* Engine Heads-Up Flags */}
          {plan.flags.length > 0 && (
            <section aria-labelledby="heads-up-heading" className="space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" aria-hidden="true" />
                <h2 id="heads-up-heading" className="font-serif text-xl font-bold text-ink">
                  Heads-up Recommendations
                </h2>
              </div>

              <div className="space-y-3">
                {plan.flags.map((flag, idx) => (
                  <div
                    key={`${flag.code}-${idx}`}
                    className="flex items-start gap-3 rounded-card border border-surface-border bg-surface p-4 text-left"
                  >
                    <StatusChip status={flag.severity} size="sm" />
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-semibold text-ink">{flag.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Ideas for Your Celebration Card */}
          <IdeasCard
            ideas={ideas}
            ideasLoading={ideasLoading}
            isSlowWriting={isSlowWriting}
            ideasError={ideasError}
            onRefresh={() => fetchIdeas(true)}
            onStop={handleStopGeneration}
          />
        </div>

        {/* Side Column (4 cols) */}
        <PlanSidebar plan={plan} />
      </div>

      {/* Confirmation Dialog for "Clear My Data" */}
      <Dialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Clear All Celebration Data?</DialogTitle>
            <DialogDescription>
              This will permanently delete your celebration plan and local overrides from this
              browser. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsClearDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="danger" onClick={handleConfirmClear}>
              Clear Data
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
