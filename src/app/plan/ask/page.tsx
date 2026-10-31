'use client';

import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Bot,
  Send,
  Trash2,
  Sparkles,
  Check,
  X,
  ArrowRight,
  AlertTriangle,
  RotateCcw,
  Sliders,
  Calendar,
  Users,
  IndianRupee,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePlan } from '@/context/plan-context';
import { fetchAiChat, ChatResponse, ClientApiError } from '@/lib/client-fetch';
import { formatInr } from '@/domain/money/inr';

const CHAT_STORAGE_KEY = 'utsav_ask_chat_history';
const MAX_HISTORY = 20;

const SUGGESTIONS = [
  'What if we cut the guest list to 150?',
  'Move the date to 2027-03-12',
  'Increase the budget by 5 lakh',
  'What should I book first?',
];

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  patch?: Record<string, unknown>;
  diff?: {
    summaryFacts: string[];
    totalDelta?: number;
    cateringEstimateDelta?: number;
    flagsAdded?: string[];
    flagsRemoved?: string[];
    milestonesShifted?: Array<{
      id: string;
      beforeDate: string;
      afterDate: string;
      daysDelta: number;
    }>;
  };
  proposalStatus?: 'pending' | 'applied' | 'dismissed';
}

export default function AskPage() {
  const { profile, plan, applyPatch, loadSample } = usePlan();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatError, setChatError] = useState<ClientApiError | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load chat history from sessionStorage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(CHAT_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setMessages(parsed);
        }
      } else {
        // Welcome message
        setMessages([
          {
            id: 'welcome',
            sender: 'assistant',
            text: 'Namaste! I am your celebration planning assistant. Ask questions about rituals, budget trade-offs, or tell me to adjust your guest count, budget, or dates.',
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  // Sync chat history to sessionStorage
  const saveMessages = (msgs: ChatMessage[]) => {
    const trimmed = msgs.slice(-MAX_HISTORY);
    setMessages(trimmed);
    try {
      sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(trimmed));
    } catch {}
  };

  // Scroll to bottom on new message
  useEffect(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const handleClearChat = () => {
    const fresh: ChatMessage[] = [
      {
        id: `msg-${Date.now()}`,
        sender: 'assistant',
        text: 'Chat history cleared. How can I assist with your celebration today?',
        timestamp: new Date().toISOString(),
      },
    ];
    saveMessages(fresh);
    setChatError(null);
  };

  const handleSend = async (messageText?: string) => {
    const textToSend = (messageText ?? inputValue).trim();
    if (!textToSend || isLoading || !profile) return;

    if (textToSend.length > 500) {
      return;
    }

    const userMessage: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toISOString(),
    };

    const updated = [...messages, userMessage];
    saveMessages(updated);
    setInputValue('');
    setChatError(null);
    setIsLoading(true);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const res = await fetchAiChat(profile, textToSend, controller.signal);
    setIsLoading(false);

    if (res.ok) {
      const hasProposal = !!res.data.patch && Object.keys(res.data.patch).length > 0;
      const assistantMessage: ChatMessage = {
        id: `asst-${Date.now()}`,
        sender: 'assistant',
        text: res.data.reply,
        timestamp: new Date().toISOString(),
        patch: res.data.patch,
        diff: res.data.diff,
        proposalStatus: hasProposal ? 'pending' : undefined,
      };
      saveMessages([...updated, assistantMessage]);
    } else {
      if (res.error.code !== 'ABORTED') {
        setChatError(res.error);
      }
    }
  };

  const handleApplyProposal = (messageId: string, patch: Record<string, unknown>) => {
    applyPatch(patch);
    const updated = messages.map((m) =>
      m.id === messageId ? { ...m, proposalStatus: 'applied' as const } : m
    );
    saveMessages(updated);
  };

  const handleDismissProposal = (messageId: string) => {
    const updated = messages.map((m) =>
      m.id === messageId ? { ...m, proposalStatus: 'dismissed' as const } : m
    );
    saveMessages(updated);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!profile || !plan) {
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
              Set up your celebration details to consult with the planning assistant, simulate
              budget trade-offs, and receive contextual advice.
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
              onClick={() => loadSample('wedding')}
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

  return (
    <div className="flex h-[calc(100vh-12rem)] min-h-[500px] flex-col justify-between text-left">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-surface-border pb-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-control border border-surface-border bg-surface px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-secondary">
            <Bot className="h-3.5 w-3.5" aria-hidden="true" />
            <span>GenAI Event Assistant</span>
          </div>
          <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight text-ink">
            Ask Event Assistant
          </h1>
          <p className="text-ink/75 text-xs">
            {profile.cityName} • {profile.guestCount} guests • Proposed plan adjustments require
            your explicit confirmation.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleClearChat}
          className="text-ink/70 h-8 gap-1.5 text-xs hover:text-danger"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>Clear chat</span>
        </Button>
      </header>

      {/* Chat Messages Container */}
      <div
        role="log"
        aria-live="polite"
        aria-label="Conversation with Event Assistant"
        className="flex-1 space-y-4 overflow-y-auto py-4 pr-1"
      >
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';

          return (
            <div key={msg.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
              <div
                className={`max-w-2xl rounded-card p-4 text-sm leading-relaxed ${
                  isUser
                    ? 'bg-primary text-white'
                    : 'border border-surface-border bg-surface text-ink'
                }`}
              >
                {!isUser && (
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-secondary">
                    <Bot className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Planning Assistant</span>
                  </div>
                )}

                {/* Message Body as Plain Text */}
                <p className="whitespace-pre-wrap">{msg.text}</p>

                {/* Proposed Change Block */}
                {!isUser && msg.patch && msg.diff && (
                  <div className="bg-bg/70 mt-3 rounded-control border border-surface-border p-3 text-xs text-ink">
                    <div className="border-surface-border/50 flex items-center justify-between border-b pb-2">
                      <span className="font-serif font-bold text-ink">
                        Proposed Plan Adjustment
                      </span>
                      {msg.proposalStatus === 'applied' && (
                        <span className="bg-secondary/15 rounded px-2 py-0.5 text-[11px] font-semibold text-secondary">
                          Applied to plan
                        </span>
                      )}
                      {msg.proposalStatus === 'dismissed' && (
                        <span className="bg-surface-border/50 text-ink/70 rounded px-2 py-0.5 text-[11px] font-medium">
                          Discarded
                        </span>
                      )}
                    </div>

                    {/* Diff Chips */}
                    <div className="my-2.5 flex flex-wrap gap-1.5">
                      {msg.diff.cateringEstimateDelta !== undefined &&
                        msg.diff.cateringEstimateDelta !== 0 && (
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium tabular-nums ${
                              msg.diff.cateringEstimateDelta > 0
                                ? 'border-warning/30 bg-warning/15 border text-warning'
                                : 'border-secondary/30 bg-secondary/15 border text-secondary'
                            }`}
                          >
                            Catering {msg.diff.cateringEstimateDelta > 0 ? '+' : ''}
                            {formatInr(msg.diff.cateringEstimateDelta)}
                          </span>
                        )}

                      {msg.diff.totalDelta !== undefined && msg.diff.totalDelta !== 0 && (
                        <span className="border-primary/30 bg-primary/10 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tabular-nums text-primary">
                          Budget {msg.diff.totalDelta > 0 ? '+' : ''}
                          {formatInr(msg.diff.totalDelta)}
                        </span>
                      )}

                      {msg.diff.milestonesShifted && msg.diff.milestonesShifted.length > 0 && (
                        <span className="rounded-full border border-surface-border bg-surface px-2.5 py-0.5 text-[11px] font-medium text-ink">
                          {msg.diff.milestonesShifted.length} milestone
                          {msg.diff.milestonesShifted.length > 1 ? 's' : ''} shifted
                        </span>
                      )}
                    </div>

                    {/* Summary facts */}
                    {msg.diff.summaryFacts && msg.diff.summaryFacts.length > 0 && (
                      <ul className="text-ink/80 list-inside list-disc space-y-0.5 text-[11px]">
                        {msg.diff.summaryFacts.map((fact, idx) => (
                          <li key={idx}>{fact}</li>
                        ))}
                      </ul>
                    )}

                    {/* Interactive Actions */}
                    {msg.proposalStatus === 'pending' && (
                      <div className="border-surface-border/50 mt-3 flex flex-wrap items-center gap-2 border-t pt-2.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="primary"
                          onClick={() => handleApplyProposal(msg.id, msg.patch!)}
                          className="h-7 gap-1 text-xs"
                        >
                          <Check className="h-3 w-3" />
                          <span>Apply change</span>
                        </Button>

                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleDismissProposal(msg.id)}
                          className="h-7 gap-1 text-xs"
                        >
                          <X className="h-3 w-3" />
                          <span>No thanks</span>
                        </Button>
                      </div>
                    )}

                    {msg.proposalStatus === 'applied' && (
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
        })}

        {isLoading && (
          <div className="flex items-start">
            <div className="text-ink/75 max-w-md rounded-card border border-surface-border bg-surface p-4 text-xs">
              <div className="flex items-center gap-2">
                <Bot className="h-3.5 w-3.5 animate-pulse text-secondary" />
                <span>Assistant is evaluating trade-offs...</span>
              </div>
            </div>
          </div>
        )}

        {chatError && (
          <div className="border-warning/30 bg-warning/5 rounded-control border p-3 text-xs text-warning">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <div>
                <p className="font-semibold">{chatError.message}</p>
                {chatError.retryAfterSeconds && (
                  <p className="text-ink/75 mt-0.5">
                    Retry recommendation: wait {chatError.retryAfterSeconds} seconds.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Sticky Composer Area */}
      <footer className="space-y-2.5 border-t border-surface-border pt-3">
        {/* Suggestion Chips */}
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-ink/60 mr-1 text-[11px]">Suggestions:</span>
          {SUGGESTIONS.map((chip, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSend(chip)}
              disabled={isLoading}
              className="touch-target inline-flex items-center rounded-full border border-surface-border bg-surface px-2.5 py-1 text-xs text-ink transition-colors hover:border-secondary hover:text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Input Box and Send Button */}
        <div className="relative flex items-end gap-2 rounded-card border border-surface-border bg-surface p-2 focus-within:border-primary">
          <textarea
            ref={textareaRef}
            rows={2}
            value={inputValue}
            maxLength={500}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder="Ask about rituals, vendors, or test changes (e.g. 'Move date to 2027-03-12')..."
            className="placeholder:text-ink/50 w-full resize-none bg-transparent px-2 py-1 text-sm text-ink focus:outline-none"
            aria-label="Ask the planning assistant"
          />

          <div className="flex shrink-0 flex-col items-end gap-1 pb-0.5">
            <span className="text-ink/50 text-[10px] tabular-nums">{inputValue.length} / 500</span>

            <Button
              type="button"
              size="sm"
              variant="primary"
              onClick={() => handleSend()}
              disabled={isLoading || !inputValue.trim()}
              aria-label="Send message"
              className="h-8 w-8 rounded-control p-0"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
}
