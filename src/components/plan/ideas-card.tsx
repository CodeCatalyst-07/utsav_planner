'use client';

import * as React from 'react';
import { Sparkles, Square, RotateCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IdeasResponse, ClientApiError } from '@/lib/client-fetch';

interface IdeasCardProps {
  ideas: IdeasResponse | null;
  ideasLoading: boolean;
  isSlowWriting: boolean;
  ideasError: ClientApiError | null;
  onRefresh: () => void;
  onStop: () => void;
}

export function IdeasCard({
  ideas,
  ideasLoading,
  isSlowWriting,
  ideasError,
  onRefresh,
  onStop,
}: IdeasCardProps) {
  const providerLabel =
    ideas?.meta?.provider === 'jarvis'
      ? 'Gemma via Jarvis'
      : ideas?.meta?.provider === 'gemini'
        ? 'Google Gemini'
        : 'Deterministic Template';

  return (
    <section
      aria-labelledby="ideas-heading"
      className="rounded-card border border-surface-border bg-surface p-6 text-left"
    >
      <div className="border-surface-border/60 flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-secondary" aria-hidden="true" />
          <h2 id="ideas-heading" className="font-serif text-xl font-bold text-ink">
            Ideas for your celebration
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {ideasLoading && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onStop}
              aria-label="Stop idea generation and use offline template ideas"
              className="h-8 gap-1.5 text-xs focus-visible:ring-2 focus-visible:ring-primary"
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
            disabled={ideasLoading}
            className="h-8 gap-1.5 text-xs"
          >
            <RotateCw className={`h-3 w-3 ${ideasLoading ? 'animate-spin' : ''}`} />
            <span>Refresh ideas</span>
          </Button>
        </div>
      </div>

      {/* Ideas Card Body */}
      <div className="pt-4">
        {ideasLoading ? (
          <div className="space-y-4" aria-busy="true">
            {isSlowWriting && (
              <div
                role="status"
                aria-live="polite"
                className="border-secondary/30 bg-secondary/10 rounded-control border px-3 py-2 text-xs font-medium text-secondary"
              >
                Still writing... you can stop and use the offline ideas
              </div>
            )}
            <div className="bg-surface-border/50 h-4 w-1/3 animate-pulse rounded" />
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-bg/50 space-y-2 rounded-control p-4">
                  <div className="bg-surface-border/60 h-4 w-1/4 animate-pulse rounded" />
                  <div className="bg-surface-border/40 h-3 w-5/6 animate-pulse rounded" />
                </div>
              ))}
            </div>
          </div>
        ) : ideasError ? (
          <div className="border-warning/30 bg-warning/5 rounded-control border p-4 text-xs">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <div className="space-y-1">
                <p className="font-semibold text-warning">{ideasError.message}</p>
                {ideasError.retryAfterSeconds && (
                  <p className="text-ink/75">
                    Retry recommendation: wait {ideasError.retryAfterSeconds} seconds before
                    requesting fresh AI ideas.
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : ideas?.data?.themes ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {ideas.data.themes.map((theme, idx) => (
                <div
                  key={idx}
                  className="border-surface-border/80 bg-bg/40 flex flex-col justify-between rounded-control border p-4"
                >
                  <div>
                    <h3 className="font-serif text-sm font-bold text-ink">{theme.title}</h3>
                    <p className="text-ink/80 mt-2 text-xs leading-relaxed">{theme.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-surface-border/60 text-ink/60 flex flex-wrap items-center justify-between border-t pt-3 text-xs">
              <span>Written by AI: {providerLabel}</span>
              <span>Ideas are AI-written. Numbers and dates come from the planning engine.</span>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
