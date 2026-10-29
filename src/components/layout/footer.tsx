import * as React from 'react';
import { BRAND_DISCLAIMER, BRAND_NAME, BRAND_TAGLINE } from '@/lib/brand';

export function Footer() {
  return (
    <footer className="mt-auto border-t border-surface-border bg-surface pb-20 pt-8 lg:pb-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
          <div>
            <p className="font-serif text-base font-bold text-ink">{BRAND_NAME}</p>
            <p className="text-ink/70 text-sm">{BRAND_TAGLINE}</p>
          </div>
          <div className="rounded-control border border-surface-border bg-bg px-3 py-1.5">
            <p className="text-ink/80 text-xs font-semibold tracking-wide">{BRAND_DISCLAIMER}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
