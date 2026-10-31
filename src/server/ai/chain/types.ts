import 'server-only';
import { ZodSchema } from 'zod';
import { LLMProvider, ProviderName } from '../provider';
import { CircuitBreaker } from '@/server/security/circuitBreaker';
import { AICache } from '../cache';
import { GeminiCritic, CriticVerdict, CriticStatus } from '../critic';
import { JarvisProvider } from '../jarvis';
import { GeminiProvider } from '../gemini';
import { ValidationContext } from '../validators';
import { ReasoningMode } from '../sections';

export interface AIMetadata {
  provider: ProviderName;
  attempts: number;
  repaired: boolean;
  fallbackReason?: string;
  latencyMs: number;
  promptVersion: string;
  cached: boolean;
  critic: CriticStatus;
  criticVerdict?: CriticVerdict;
  skippedProviders?: Array<{ provider: string; reason: string }>;
}

export interface SectionExecutionResult<T> {
  data: T;
  meta: AIMetadata;
}

export interface FailoverChainOptions {
  jarvis?: JarvisProvider;
  gemini?: GeminiProvider;
  jarvisBreaker?: CircuitBreaker;
  geminiBreaker?: CircuitBreaker;
  cache?: AICache;
  critic?: GeminiCritic;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export interface Candidate {
  name: 'jarvis' | 'gemini';
  provider: LLMProvider;
  breaker: CircuitBreaker;
  isConfigured: () => boolean;
}

export interface AttemptResult<T> {
  success: boolean;
  data?: T;
  attempts: number;
  repaired: boolean;
  error?: string;
}

export interface AttemptRunnerArgs<T> {
  candidate: Candidate;
  promptData: { system: string; user: string };
  schema: ZodSchema<T>;
  validationContext?: ValidationContext;
  requestId: string;
  deadline: number;
  reasoning?: ReasoningMode;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
}
