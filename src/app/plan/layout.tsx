import * as React from 'react';
import { AppNav } from '@/components/layout/nav';

export default function PlanLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="flex flex-col lg:flex-row lg:gap-8">
        {/* Desktop Left Side Navigation (>=1024px) */}
        <AppNav variant="desktop-sidebar" />

        {/* Content Area (max-width 1120px on desktop) */}
        <main
          id="main-content"
          className="w-full max-w-[1120px] flex-1 pb-24 focus-visible:outline-none lg:pb-12"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
