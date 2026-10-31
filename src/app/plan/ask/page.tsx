'use client';

import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { Bot, Send, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePlan } from '@/context/plan-context';
import { fetchAiChat, ClientApiError } from '@/lib/client-fetch';
import {
  ChatMessage,
  CHAT_STORAGE_KEY,
  MAX_HISTORY,
  SUGGESTIONS,
} from '@/components/ask/chat-types';
import { AskEmptyState } from '@/components/ask/ask-empty-state';
import { ChatMessageItem } from '@/components/ask/chat-message-item';

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
    return <AskEmptyState onLoadSample={loadSample} />;
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
        {messages.map((msg) => (
          <ChatMessageItem
            key={msg.id}
            message={msg}
            onApplyProposal={handleApplyProposal}
            onDismissProposal={handleDismissProposal}
          />
        ))}

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
