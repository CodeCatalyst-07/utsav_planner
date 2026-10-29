'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, IndianRupee, Clock, Store, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const NAV_ITEMS: NavItem[] = [
  { name: 'Plan', href: '/plan', icon: CalendarDays },
  { name: 'Budget', href: '/plan/budget', icon: IndianRupee },
  { name: 'Timeline', href: '/plan/timeline', icon: Clock },
  { name: 'Vendors', href: '/plan/vendors', icon: Store },
  { name: 'Ask', href: '/plan/ask', icon: MessageSquare },
];

interface NavProps {
  className?: string;
  variant?: 'desktop-sidebar' | 'mobile-bottom';
}

export function AppNav({ className, variant = 'desktop-sidebar' }: NavProps) {
  const pathname = usePathname();

  const isItemActive = (href: string) => {
    if (href === '/plan') {
      return pathname === '/plan';
    }
    return pathname.startsWith(href);
  };

  if (variant === 'mobile-bottom') {
    return (
      <nav
        aria-label="Mobile Bottom Navigation"
        className={cn(
          'safe-area-bottom fixed bottom-0 left-0 right-0 z-40 border-t border-surface-border bg-surface lg:hidden',
          className
        )}
      >
        <ul className="flex h-16 items-center justify-around px-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isItemActive(item.href);

            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'touch-target flex flex-col items-center justify-center rounded-control py-1 text-xs font-medium transition-colors',
                    active ? 'font-bold text-primary' : 'text-ink/70 hover:bg-bg/50 hover:text-ink'
                  )}
                >
                  <Icon className={cn('mb-1 h-5 w-5', active ? 'text-primary' : 'text-ink/60')} />
                  <span>{item.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  // Desktop left side navigation (>=1024px)
  return (
    <nav
      aria-label="Primary Workspace Navigation"
      className={cn('hidden w-64 shrink-0 pr-6 lg:block', className)}
    >
      <div className="sticky top-24 space-y-1">
        <p className="text-ink/60 px-3 py-2 text-xs font-semibold uppercase tracking-wider">
          Event Workspace
        </p>
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isItemActive(item.href);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'touch-target flex items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium transition-colors',
                    active
                      ? 'border border-surface-border bg-surface font-semibold text-primary shadow-sm'
                      : 'text-ink/75 hover:bg-surface/50 hover:text-ink'
                  )}
                >
                  <Icon
                    className={cn('h-4 w-4 shrink-0', active ? 'text-primary' : 'text-ink/60')}
                  />
                  <span>{item.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
