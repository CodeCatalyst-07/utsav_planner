import * as React from 'react';
import { cn } from '@/lib/utils';

interface DecorativeMotifProps {
  className?: string;
  size?: number;
}

/**
 * Geometric Indian Rangoli / Mandala motif.
 * One decorative element only, rendered in --accent (#f59e0b).
 * Flat inline-SVG, strictly aria-hidden, zero text, zero animation.
 */
export function DecorativeMotif({ className, size = 64 }: DecorativeMotifProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      className={cn('shrink-0 text-accent', className)}
    >
      {/* Central diamond */}
      <polygon
        points="32,20 44,32 32,44 20,32"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* 8-point outer petal stars */}
      <polygon
        points="32,8 36,24 52,24 39,34 44,50 32,40 20,50 25,34 12,24 28,24"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      {/* Inner concentric point */}
      <circle cx="32" cy="32" r="3.5" fill="currentColor" />
      {/* Cardinal accents */}
      <circle cx="32" cy="12" r="1.5" fill="currentColor" />
      <circle cx="52" cy="32" r="1.5" fill="currentColor" />
      <circle cx="32" cy="52" r="1.5" fill="currentColor" />
      <circle cx="12" cy="32" r="1.5" fill="currentColor" />
    </svg>
  );
}

/**
 * Wide horizontal rangoli geometric border motif.
 */
export function DecorativeMotifBorder({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      className={cn('h-6 w-auto text-accent', className)}
    >
      <path
        d="M0 12h30m180 0h30M30 12l15-8 15 8-15 8-15-8zm30 0l15-8 15 8-15 8-15-8zm30 0l15-8 15 8-15 8-15-8zm30 0l15-8 15 8-15 8-15-8zm30 0l15-8 15 8-15 8-15-8zm30 0l15-8 15 8-15 8-15-8z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="60" cy="12" r="2" fill="currentColor" />
      <circle cx="90" cy="12" r="2" fill="currentColor" />
      <circle cx="120" cy="12" r="2" fill="currentColor" />
      <circle cx="150" cy="12" r="2" fill="currentColor" />
      <circle cx="180" cy="12" r="2" fill="currentColor" />
    </svg>
  );
}
