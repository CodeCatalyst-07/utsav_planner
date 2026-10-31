import 'server-only';
import { AIMetadata } from './types';
import { ProviderName } from '../provider';
import { CriticVerdict, CriticStatus } from '../critic';
import { PROMPT_VERSION } from '../prompts';
import { getEnv } from '@/server/env';

export interface BuildMetaArgs {
  provider: ProviderName;
  model?: string | null;
  attempts: number;
  repaired: boolean;
  startTime: number;
  now: () => number;
  cached?: boolean;
  fallbackReason?: string;
  critic?: CriticStatus;
  criticVerdict?: CriticVerdict;
  skippedProviders?: Array<{ provider: string; reason: string }>;
}

/**
 * Builds a standardized AIMetadata response object adhering to the strict schema.
 * Omits criticVerdict when critic did not run or failed.
 */
export function buildChainMeta(args: BuildMetaArgs): AIMetadata {
  const {
    provider,
    attempts,
    repaired,
    startTime,
    now,
    cached = false,
    fallbackReason,
    critic = 'skipped',
    criticVerdict,
    skippedProviders,
  } = args;

  let resolvedModel: string | null = null;
  if (args.model !== undefined) {
    resolvedModel = args.model;
  } else if (provider === 'template') {
    resolvedModel = null;
  } else if (provider === 'jarvis') {
    try {
      resolvedModel = getEnv().JARVIS_MODEL;
    } catch {
      resolvedModel = 'gemma-4-31b-it';
    }
  } else if (provider === 'gemini') {
    try {
      resolvedModel = getEnv().GEMINI_MODEL ?? 'gemini-2.5-flash';
    } catch {
      resolvedModel = 'gemini-2.5-flash';
    }
  }

  const meta: AIMetadata = {
    provider,
    model: resolvedModel,
    attempts,
    repaired,
    latencyMs: now() - startTime,
    promptVersion: PROMPT_VERSION,
    cached,
    critic,
  };

  if (fallbackReason) {
    meta.fallbackReason = fallbackReason;
  }

  if (critic === 'ran' && criticVerdict) {
    meta.criticVerdict = criticVerdict;
  }

  if (skippedProviders && skippedProviders.length > 0) {
    meta.skippedProviders = skippedProviders;
  }

  return meta;
}
