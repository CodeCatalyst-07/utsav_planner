import * as React from 'react';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  AlertOctagon,
  Info,
  LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type StatusType = 'ok' | 'tight' | 'over' | 'warning' | 'critical' | 'info';

interface StatusConfig {
  icon: LucideIcon;
  label: string;
  className: string;
  iconClassName: string;
}

const STATUS_CONFIGS: Record<StatusType, StatusConfig> = {
  ok: {
    icon: CheckCircle2,
    label: 'Healthy',
    className: 'bg-secondary/10 text-secondary border-secondary/30',
    iconClassName: 'text-secondary',
  },
  tight: {
    icon: AlertCircle,
    label: 'Tight',
    className: 'bg-warning/10 text-warning border-warning/30',
    iconClassName: 'text-warning',
  },
  over: {
    icon: AlertTriangle,
    label: 'Over Budget',
    className: 'bg-danger/10 text-danger border-danger/30',
    iconClassName: 'text-danger',
  },
  warning: {
    icon: AlertTriangle,
    label: 'Warning',
    className: 'bg-warning/10 text-warning border-warning/30',
    iconClassName: 'text-warning',
  },
  critical: {
    icon: AlertOctagon,
    label: 'Critical',
    className: 'bg-danger/10 text-danger border-danger/30',
    iconClassName: 'text-danger',
  },
  info: {
    icon: Info,
    label: 'Note',
    className: 'bg-surface border-surface-border text-ink/80',
    iconClassName: 'text-ink/60',
  },
};

interface StatusChipProps {
  status: StatusType;
  customLabel?: string;
  className?: string;
  size?: 'sm' | 'default';
}

export function StatusChip({ status, customLabel, className, size = 'default' }: StatusChipProps) {
  const config = STATUS_CONFIGS[status] ?? STATUS_CONFIGS.info;
  const Icon = config.icon;
  const text = customLabel || config.label;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium tabular-nums',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs sm:text-sm',
        config.className,
        className
      )}
    >
      <Icon className={cn('h-3.5 w-3.5 shrink-0', config.iconClassName)} aria-hidden="true" />
      <span>{text}</span>
    </span>
  );
}
