'use client';

import * as React from 'react';
import Link from 'next/link';
import { Bot, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatInr } from '@/domain/money/inr';
import { ChatMessage } from './chat-types';

interface ChatMessageItemProps {
  message: ChatMessage;
  onApplyProposal: (messageId: string, patch: Record<string, unknown>) => void;
  onDismissProposal: (messageId: string) => void;
}

export function ChatMessageItem({
  message,
  onApplyProposal,
  onDismissProposal,
}: ChatMessageItemProps) {
  const isUser = message.sender === 'user';

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
      <div
        className={`max-w-2xl rounded-card p-4 text-sm leading-relaxed ${
          isUser ? 'bg-primary text-white' : 'border border-surface-border bg-surface text-ink'
        }`}
      >
        {!isUser && (
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-secondary">
            <Bot className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Planning Assistant</span>
          </div>
        )}

        {/* Message Body as Plain Text */}
        <p className="whitespace-pre-wrap">{message.text}</p>

        {/* Proposed Change Block */}
        {!isUser && message.patch && message.diff && (
          <div className="bg-bg/70 mt-3 rounded-control border border-surface-border p-3 text-xs text-ink">
            <div className="border-surface-border/50 flex items-center justify-between border-b pb-2">
              <span className="font-serif font-bold text-ink">Proposed Plan Adjustment</span>
              {message.proposalStatus === 'applied' && (
                <span className="bg-secondary/15 rounded px-2 py-0.5 text-[11px] font-semibold text-secondary">
                  Applied to plan
                </span>
              )}
              {message.proposalStatus === 'dismissed' && (
                <span className="bg-surface-border/50 text-ink/70 rounded px-2 py-0.5 text-[11px] font-medium">
                  Discarded
                </span>
              )}
            </div>

            {/* Diff Chips */}
            <div className="my-2.5 flex flex-wrap gap-1.5">
              {message.diff.cateringEstimateDelta !== undefined &&
                message.diff.cateringEstimateDelta !== 0 && (
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium tabular-nums ${
                      message.diff.cateringEstimateDelta > 0
                        ? 'border-warning/30 bg-warning/15 border text-warning'
                        : 'border-secondary/30 bg-secondary/15 border text-secondary'
                    }`}
                  >
                    Catering {message.diff.cateringEstimateDelta > 0 ? '+' : ''}
                    {formatInr(message.diff.cateringEstimateDelta)}
                  </span>
                )}

              {message.diff.totalDelta !== undefined && message.diff.totalDelta !== 0 && (
                <span className="border-primary/30 bg-primary/10 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tabular-nums text-primary">
                  Budget {message.diff.totalDelta > 0 ? '+' : ''}
                  {formatInr(message.diff.totalDelta)}
                </span>
              )}

              {message.diff.milestonesShifted && message.diff.milestonesShifted.length > 0 && (
                <span className="rounded-full border border-surface-border bg-surface px-2.5 py-0.5 text-[11px] font-medium text-ink">
                  {message.diff.milestonesShifted.length} milestone
                  {message.diff.milestonesShifted.length > 1 ? 's' : ''} shifted
                </span>
              )}
            </div>

            {/* Summary facts */}
            {message.diff.summaryFacts && message.diff.summaryFacts.length > 0 && (
              <ul className="text-ink/80 list-inside list-disc space-y-0.5 text-[11px]">
                {message.diff.summaryFacts.map((fact, idx) => (
                  <li key={idx}>{fact}</li>
                ))}
              </ul>
            )}

            {/* Interactive Actions */}
            {message.proposalStatus === 'pending' && (
              <div className="border-surface-border/50 mt-3 flex flex-wrap items-center gap-2 border-t pt-2.5">
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  onClick={() => onApplyProposal(message.id, message.patch!)}
                  className="h-7 gap-1 text-xs"
                >
                  <Check className="h-3 w-3" />
                  <span>Apply change</span>
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onDismissProposal(message.id)}
                  className="h-7 gap-1 text-xs"
                >
                  <X className="h-3 w-3" />
                  <span>No thanks</span>
                </Button>
              </div>
            )}

            {message.proposalStatus === 'applied' && (
              <div className="mt-2.5 flex items-center gap-2 text-[11px] text-secondary">
                <Check className="h-3.5 w-3.5" />
                <span>
                  Plan updated successfully.{' '}
                  <Link href="/plan/budget" className="font-semibold underline">
                    See budget breakdown
                  </Link>
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
