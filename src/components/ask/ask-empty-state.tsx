'use client';

import * as React from 'react';
import Link from 'next/link';
import { Bot, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SampleProfileKind } from '@/domain/fixtures/profiles';

interface AskEmptyStateProps {
  onLoadSample: (kind: SampleProfileKind) => void;
}

export function AskEmptyState({ onLoadSample }: AskEmptyStateProps) {
  return (
    <div className="w-full space-y-6 text-left">
      <header className="border-b border-surface-border pb-4">
        <div className="inline-flex items-center gap-2 rounded-control border border-surface-border bg-surface px-3 py-1 text-xs font-semibold uppercase tracking-wider text-secondary">
          <Bot className="h-3.5 w-3.5" aria-hidden="true" />
          <span>AI Planning Assistant</span>
        </div>
        <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight text-ink">
          Ask Event Assistant
        </h1>
        <p className="text-ink/75 mt-1 text-sm sm:text-base">
          Ask questions about traditions, ritual sequences, guest hospitality, or test what-if
          adjustments.
        </p>
      </header>

      <section
        aria-labelledby="ask-empty-heading"
        className="space-y-6 rounded-card border border-surface-border bg-surface p-8 sm:p-12"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-control bg-bg text-primary">
          <Bot className="h-6 w-6" aria-hidden="true" />
        </div>

        <div className="max-w-xl space-y-2">
          <h2 id="ask-empty-heading" className="font-serif text-2xl font-bold text-ink">
            No celebration blueprint configured yet
          </h2>
          <p className="text-ink/80 text-sm leading-relaxed sm:text-base">
            Set up your celebration details to consult with the planning assistant, simulate budget
            trade-offs, and receive contextual advice.
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
            onClick={() => onLoadSample('wedding')}
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
