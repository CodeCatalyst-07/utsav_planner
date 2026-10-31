'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { AssumptionItem } from '@/domain/rules/assumptions';

export interface AssumptionsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  assumptions: AssumptionItem[];
}

export function AssumptionsDialog({ isOpen, onOpenChange, assumptions }: AssumptionsDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Engine Planning Assumptions</DialogTitle>
          <DialogDescription>
            Deterministic allocation baselines derived from Indian event data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2 text-left">
          <div className="bg-bg/50 text-ink/80 rounded-control border border-surface-border p-3 text-xs">
            <span className="font-semibold text-ink">Honest note:</span> Typical estimates from
            public sources, not vendor quotes. Always get 3 quotes from local service providers.
          </div>

          <div className="divide-surface-border/60 divide-y">
            {assumptions.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between py-2 text-xs">
                <div>
                  <span className="font-semibold text-ink">{item.label}</span>
                  <span className="bg-surface-border/50 text-ink/70 ml-2 rounded px-1.5 py-0.5 text-[10px] uppercase">
                    {item.source}
                  </span>
                </div>
                <span className="text-ink/90 font-medium tabular-nums">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
