import 'server-only';
import { z } from 'zod';
import { EventProfile } from '@/domain/schemas/profile';
import { GeminiProvider } from './gemini';
import { extractJsonObject } from './jsonExtract';
import { logger } from '@/server/security/logger';
import { getEnv } from '@/server/env';

export const CriticIssueSchema = z.object({
  section: z.string().trim().min(1),
  problem: z.string().trim().min(1).max(160),
});

export const CriticVerdictSchema = z.object({
  approved: z.boolean(),
  issues: z.array(CriticIssueSchema),
});
export type CriticVerdict = z.infer<typeof CriticVerdictSchema>;

export class GeminiCritic {
  private readonly gemini: GeminiProvider;
  private readonly enabled: boolean;

  constructor(options?: { gemini?: GeminiProvider; enabled?: boolean }) {
    this.gemini = options?.gemini ?? new GeminiProvider();
    if (options?.enabled !== undefined) {
      this.enabled = options.enabled;
    } else {
      try {
        const env = getEnv();
        this.enabled = env.CRITIC_ENABLED && Boolean(env.GEMINI_API_KEY && env.GEMINI_MODEL);
      } catch {
        this.enabled = false;
      }
    }
  }

  isEnabled(): boolean {
    return this.enabled && this.gemini.isConfigured();
  }

  /**
   * Evaluates generated sections against profile constraints (dietary mix, budget tier, cultural fit).
   * Invariant: Critic failure NEVER blocks response; errors gracefully return approved=true with no issues.
   */
  async evaluateSections(
    profile: EventProfile,
    sections: Record<string, unknown>,
    requestId: string = 'critic'
  ): Promise<CriticVerdict> {
    if (!this.isEnabled()) {
      return { approved: true, issues: [] };
    }

    const systemPrompt = `You are the cultural and quality critic for Utsav Planner, an Indian celebration planning app.
Review generated event sections against the user's event profile.
Check for:
1. Dietary contradiction (e.g., non-veg items offered to Jain/pure-veg guests, or lack of Jain items when Jain guests are specified).
2. Budget tier mismatch (e.g., ultra-luxury caviar for budget tier, or low-grade items for premium).
3. Cultural fit and event suitability (e.g., wedding rituals in a kids party, or somber music for a sangeet).
4. Hallucinated commercial claims (guarantees, fake prices, or fake contacts).

Respond strictly with a JSON object:
{
  "approved": boolean,
  "issues": [
    {
      "section": string (name of the section with problem, e.g. "menu" or "ideas"),
      "problem": string (max 160 characters describing the conflict clearly)
    }
  ]
}
If there are no major contradictions, set "approved": true and "issues": [].`;

    const userPrompt = `PROFILE SUMMARY:
- Event: ${profile.eventType}
- Location: ${profile.cityName || 'India'} (${profile.cityTier})
- Budget Tier: ${profile.budgetTier}
- Guests: ${profile.guestCount} (Veg: ${profile.dietary.veg}, Non-Veg: ${profile.dietary.nonVeg}, Jain: ${profile.dietary.jain}, Vegan: ${profile.dietary.vegan})

GENERATED SECTIONS TO CRITIQUE:
${JSON.stringify(sections, null, 2)}`;

    try {
      const response = await this.gemini.generateJson({
        system: systemPrompt,
        user: userPrompt,
        schemaName: 'critic_verdict',
        maxTokens: 500,
        temperature: 0.2,
        timeoutMs: 10_000,
      });

      const parsed = extractJsonObject(response.text);
      const verdict = CriticVerdictSchema.safeParse(parsed);

      if (verdict.success) {
        return verdict.data;
      }

      logger.warn({
        requestId,
        route: 'critic',
        status: 'warn',
        message: 'Critic output failed schema validation; defaulting to approved',
      });
      return { approved: true, issues: [] };
    } catch (err: unknown) {
      logger.warn({
        requestId,
        route: 'critic',
        status: 'warn',
        message: `Critic evaluation failed: ${(err as Error).message}; proceeding without critic gating`,
      });
      return { approved: true, issues: [] };
    }
  }
}
