import * as React from 'react';
import Link from 'next/link';
import { MessageSquare, ArrowRight, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AskPage() {
  return (
    <div className="space-y-6">
      <header className="border-b border-surface-border pb-4">
        <div className="inline-flex items-center gap-2 rounded-control border border-surface-border bg-surface px-3 py-1 text-xs font-semibold uppercase tracking-wider text-secondary">
          <Bot className="h-3.5 w-3.5" aria-hidden="true" />
          <span>GenAI Assistant</span>
        </div>
        <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight text-ink">
          Ask Event Assistant
        </h1>
        <p className="text-ink/75 mt-1 text-base">
          Ask questions about traditions, ritual sequences, guest hospitality, or menu ideas.
        </p>
      </header>

      <section
        aria-labelledby="ask-empty-heading"
        className="space-y-6 rounded-card border border-surface-border bg-surface p-8 sm:p-10"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-control border border-surface-border bg-bg text-primary">
          <MessageSquare className="h-6 w-6" aria-hidden="true" />
        </div>

        <div className="max-w-xl space-y-2">
          <h2 id="ask-empty-heading" className="font-serif text-2xl font-bold text-ink">
            GenAI Assistant arriving in Phase 2
          </h2>
          <p className="text-ink/80 text-base leading-relaxed">
            The multi-provider adapter layer in `src/server/llm/` will route contextual queries to
            Google Gemini or JarvisLabs (Gemma 4 31B IT) with prompt sanitization and strict rate
            limiting.
          </p>
        </div>

        <div className="pt-2">
          <Button asChild variant="primary">
            <Link href="/plan" className="gap-2">
              <span>Return to Plan Overview</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
