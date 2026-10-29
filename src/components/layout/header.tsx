import * as React from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { BRAND_NAME } from '@/lib/brand';

export function Header() {
  return (
    <header className="bg-bg/95 sticky top-0 z-30 w-full border-b border-surface-border backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="touch-target flex items-center gap-2.5 rounded-control text-ink transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-control bg-primary text-white">
            <Sparkles className="h-5 w-5 text-white" aria-hidden="true" />
          </div>
          <span className="font-serif text-xl font-bold tracking-tight text-ink">{BRAND_NAME}</span>
        </Link>

        <nav aria-label="Global Navigation">
          <ul className="flex items-center gap-4">
            <li>
              <Link
                href="/"
                className="text-ink/80 touch-target inline-flex items-center rounded-control px-2 py-1 text-sm font-medium transition-colors hover:text-ink"
              >
                Home
              </Link>
            </li>
            <li>
              <Link
                href="/plan"
                className="text-ink/80 touch-target inline-flex items-center rounded-control px-2 py-1 text-sm font-medium transition-colors hover:text-ink"
              >
                Plan Workspace
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
