'use client';

import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { Lightbulb, RotateCcw, Square, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fetchAiCategoryTips, CategoryTipsResponse, ClientApiError } from '@/lib/client-fetch';
import { buildCategoryTipsCacheKey } from '@/lib/hash';
import { EventProfile } from '@/domain/schemas/profile';

export interface TipsCardProps {
  profile: EventProfile;
  categoryLabels: Record<string, string>;
}

export function TipsCard({ profile, categoryLabels }: TipsCardProps) {
  const [categoryTips, setCategoryTips] = useState<CategoryTipsResponse | null>(null);
  const [tipsLoading, setTipsLoading] = useState(false);
  const [tipsError, setTipsError] = useState<ClientApiError | null>(null);
  const [isSlowTipsWriting, setIsSlowTipsWriting] = useState(false);

  const tipsAbortControllerRef = useRef<AbortController | null>(null);
  const tipsSlowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      tipsAbortControllerRef.current?.abort();
      if (tipsSlowTimerRef.current) clearTimeout(tipsSlowTimerRef.current);
    };
  }, []);

  const fetchTips = async (forceRefresh = false) => {
    if (!profile) return;
    const cacheKey = buildCategoryTipsCacheKey({
      eventType: profile.eventType,
      cityName: profile.cityName || '',
      totalBudgetInr: profile.totalBudgetInr,
      guestCount: profile.guestCount,
    });

    if (!forceRefresh) {
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          setCategoryTips(JSON.parse(cached));
          setTipsLoading(false);
          setTipsError(null);
          return;
        }
      } catch {}
    }

    if (tipsAbortControllerRef.current) {
      tipsAbortControllerRef.current.abort();
    }

    const controller = new AbortController();
    tipsAbortControllerRef.current = controller;

    if (tipsSlowTimerRef.current) clearTimeout(tipsSlowTimerRef.current);
    setIsSlowTipsWriting(false);
    tipsSlowTimerRef.current = setTimeout(() => {
      setIsSlowTipsWriting(true);
    }, 6000);

    setTipsLoading(true);
    setTipsError(null);

    const res = await fetchAiCategoryTips(profile, controller.signal);

    if (tipsSlowTimerRef.current) clearTimeout(tipsSlowTimerRef.current);
    setIsSlowTipsWriting(false);

    if (res.ok) {
      setCategoryTips(res.data);
      setTipsLoading(false);
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify(res.data));
      } catch {}
    } else {
      setTipsLoading(false);
      setTipsError(res.error);
    }
  };

  const handleStopTips = () => {
    if (tipsSlowTimerRef.current) clearTimeout(tipsSlowTimerRef.current);
    setIsSlowTipsWriting(false);
    if (tipsAbortControllerRef.current) {
      tipsAbortControllerRef.current.abort();
      tipsAbortControllerRef.current = null;
    }
    setTipsLoading(false);
    setTipsError({
      isError: true,
      code: 'ABORTED',
      message: 'Category tips generation was stopped by user.',
    });
  };

  return (
    <section
      aria-labelledby="category-tips-heading"
      className="rounded-card border border-surface-border bg-surface p-6 text-left"
    >
      <div className="border-surface-border/60 flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-secondary" aria-hidden="true" />
          <h2 id="category-tips-heading" className="font-serif text-lg font-bold text-ink">
            Category Saving & Negotiation Tips
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {tipsLoading && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleStopTips}
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
            onClick={() => fetchTips(!!categoryTips)}
            disabled={tipsLoading}
            className="h-8 gap-1.5 text-xs"
          >
            <RotateCcw className={`h-3 w-3 ${tipsLoading ? 'animate-spin' : ''}`} />
            <span>{categoryTips ? 'Refresh tips' : 'Get tips'}</span>
          </Button>
        </div>
      </div>

      <div className="pt-4">
        {tipsLoading ? (
          <div className="space-y-3" aria-busy="true">
            {isSlowTipsWriting && (
              <div
                role="status"
                aria-live="polite"
                className="border-secondary/30 bg-secondary/10 rounded-control border px-3 py-2 text-xs font-medium text-secondary"
              >
                Still analyzing cost categories... you can stop and use offline tips
              </div>
            )}
            <div className="bg-surface-border/50 h-4 w-1/4 animate-pulse rounded" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[1, 2].map((i) => (
                <div key={i} className="bg-bg/50 h-16 animate-pulse rounded p-4" />
              ))}
            </div>
          </div>
        ) : tipsError ? (
          <div className="border-warning/30 bg-warning/5 rounded-control border p-4 text-xs">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <div className="space-y-1">
                <p className="font-semibold text-warning">{tipsError.message}</p>
                {tipsError.retryAfterSeconds && (
                  <p className="text-ink/75">
                    Retry recommendation: wait {tipsError.retryAfterSeconds} seconds before
                    requesting fresh tips.
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : categoryTips?.data?.tips ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {categoryTips.data.tips.map((item, idx) => {
                const label = categoryLabels[item.categoryId] || item.categoryId;
                return (
                  <div
                    key={idx}
                    className="bg-bg/40 rounded-control border border-surface-border p-4 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-serif text-xs font-bold uppercase tracking-wider text-ink">
                        {label}
                      </span>
                    </div>
                    <p className="text-ink/80 mt-1.5 text-xs leading-relaxed">{item.tip}</p>
                  </div>
                );
              })}
            </div>

            <div className="border-surface-border/60 text-ink/60 flex flex-wrap items-center justify-between border-t pt-3 text-xs">
              <span>
                Provider:{' '}
                {categoryTips.meta?.provider === 'jarvis'
                  ? 'Gemma via Jarvis'
                  : categoryTips.meta?.provider === 'gemini'
                    ? 'Google Gemini'
                    : 'Deterministic Template'}
              </span>
              <span>Category advice is guidance. Confirm specifics with your vendors.</span>
            </div>
          </div>
        ) : (
          <p className="text-ink/65 text-xs">
            Click &quot;Get tips&quot; to receive tailored vendor negotiation and cost-saving advice
            for your celebration categories.
          </p>
        )}
      </div>
    </section>
  );
}
