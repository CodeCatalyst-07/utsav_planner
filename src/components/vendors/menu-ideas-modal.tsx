'use client';

import * as React from 'react';
import { UtensilsCrossed, Square, RotateCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MenuResponse, ClientApiError } from '@/lib/client-fetch';

interface MenuIdeasModalProps {
  isOpen: boolean;
  onClose: () => void;
  menuLoading: boolean;
  isSlowMenuWriting: boolean;
  menuError: ClientApiError | null;
  menuData: MenuResponse | null;
  onRefresh: () => void;
  onStop: () => void;
}

export function MenuIdeasModal({
  isOpen,
  onClose,
  menuLoading,
  isSlowMenuWriting,
  menuError,
  menuData,
  onRefresh,
  onStop,
}: MenuIdeasModalProps) {
  if (!isOpen) return null;

  return (
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
                onClick={onStop}
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
              onClick={onRefresh}
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
              onClick={onClose}
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
  );
}
