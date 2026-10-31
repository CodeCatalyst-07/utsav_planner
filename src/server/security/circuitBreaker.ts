import 'server-only';

export type CircuitBreakerState = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerOptions {
  failureThreshold?: number; // default: 3
  resetTimeoutMs?: number; // default: 30,000 (30 seconds)
  now?: () => number;
}

export class CircuitBreaker {
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly now: () => number;

  private state: CircuitBreakerState = 'closed';
  private consecutiveFailures = 0;
  private openedAt = 0;
  private activeResetTimeoutMs: number;

  constructor(options?: CircuitBreakerOptions) {
    this.failureThreshold = options?.failureThreshold ?? 3;
    this.resetTimeoutMs = options?.resetTimeoutMs ?? 30_000;
    this.activeResetTimeoutMs = this.resetTimeoutMs;
    this.now = options?.now ?? (() => Date.now());
  }

  getState(): CircuitBreakerState {
    if (this.state === 'open') {
      const elapsed = this.now() - this.openedAt;
      if (elapsed >= this.activeResetTimeoutMs) {
        this.state = 'half_open';
      }
    }
    return this.state;
  }

  canExecute(): boolean {
    const currentState = this.getState();
    return currentState === 'closed' || currentState === 'half_open';
  }

  isOpen(): boolean {
    return !this.canExecute();
  }

  /**
   * Immediately trips the circuit breaker for an explicit duration (e.g. parsed from Retry-After or retryDelay).
   */
  openFor(durationMs: number): void {
    this.state = 'open';
    this.openedAt = this.now();
    this.activeResetTimeoutMs = Math.max(1000, durationMs);
  }

  recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.state = 'closed';
    this.openedAt = 0;
    this.activeResetTimeoutMs = this.resetTimeoutMs;
  }

  recordFailure(customDurationMs?: number): void {
    this.consecutiveFailures++;
    if (customDurationMs && customDurationMs > 0) {
      this.openFor(customDurationMs);
      return;
    }
    if (this.consecutiveFailures >= this.failureThreshold || this.state === 'half_open') {
      this.state = 'open';
      this.openedAt = this.now();
      this.activeResetTimeoutMs = this.resetTimeoutMs;
    }
  }

  reset(): void {
    this.state = 'closed';
    this.consecutiveFailures = 0;
    this.openedAt = 0;
    this.activeResetTimeoutMs = this.resetTimeoutMs;
  }
}

// Global singletons per provider
export const jarvisBreaker = new CircuitBreaker();
export const geminiBreaker = new CircuitBreaker();
