import 'server-only';
import { GoogleGenAI } from '@google/genai';
import { getEnv } from '@/server/env';
import { logger } from '@/server/security/logger';

export interface GroundingSource {
  title: string;
  url: string;
}

export interface GroundedFestivalInfo {
  summary: string;
  sources: GroundingSource[];
  disclaimer: string;
}

export class GeminiGrounding {
  private readonly client?: GoogleGenAI;
  private readonly model: string;
  private readonly enabled: boolean;

  constructor(options?: { client?: GoogleGenAI; model?: string; enabled?: boolean }) {
    if (options?.client) {
      this.client = options.client;
      this.model =
        options.model ?? (typeof process !== 'undefined' ? process.env.GEMINI_MODEL : '') ?? '';
      if (!this.model) {
        this.model = 'gemini-test-model';
      }
      this.enabled = options.enabled ?? true;
      return;
    }

    try {
      const env = getEnv();
      this.enabled =
        options?.enabled ??
        (env.GROUNDING_ENABLED && Boolean(env.GEMINI_API_KEY && env.GEMINI_MODEL));
      this.model = options?.model ?? env.GEMINI_MODEL ?? '';
      if (env.GEMINI_API_KEY) {
        this.client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
      }
    } catch {
      this.enabled = false;
      this.model = '';
    }
  }

  isEnabled(): boolean {
    return Boolean(this.enabled && this.client && this.model);
  }

  /**
   * Looks up festival dates and cultural context using Gemini Google Search Grounding.
   * Invariant: Degrades gracefully on any network, quota, or parsing error by returning null.
   */
  async lookupFestivalInfo(
    festivalName: string,
    year: number | string,
    requestId: string = 'grounding'
  ): Promise<GroundedFestivalInfo | null> {
    if (!this.isEnabled() || !this.client) {
      return null;
    }

    const prompt = `Provide the primary calendar dates, regional customs, and observance details for "${festivalName}" in India for the year ${year}. Provide a concise 2-3 sentence overview.`;

    try {
      // NOTE: Grounding cannot be combined with responseMimeType='application/json' in Gemini API;
      // we generate natural text and extract citations directly from response groundingMetadata.
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          temperature: 0.2,
        },
      });

      const text = response.text?.trim();
      if (!text) return null;

      const candidate = response.candidates?.[0];
      const groundingMetadata = candidate?.groundingMetadata;
      const chunks = groundingMetadata?.groundingChunks || [];

      const sources: GroundingSource[] = [];
      const seenUrls = new Set<string>();

      for (const chunk of chunks) {
        const uri = chunk.web?.uri;
        const title = chunk.web?.title || 'Web Reference';
        if (uri && !seenUrls.has(uri)) {
          seenUrls.add(uri);
          sources.push({ title, url: uri });
        }
      }

      return {
        summary: text,
        sources: sources.slice(0, 5),
        disclaimer:
          'Please confirm specific muhurat timings and ritual dates with your family priest or local regional calendar.',
      };
    } catch (err: unknown) {
      logger.warn({
        requestId,
        route: 'grounding',
        status: 'warn',
        message: `Grounding search lookup failed: ${(err as Error).message}; degrading gracefully`,
      });
      return null;
    }
  }
}
