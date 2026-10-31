import { describe, it, expect, vi } from 'vitest';
import { GeminiCritic } from '@/server/ai/critic';
import { weddingPuneFixture } from '@/domain/fixtures/profiles';

describe('Gemini Critic Integration (src/server/ai/critic.ts)', () => {
  it('returns approved verdict when sections have no contradictions', async () => {
    const fakeGemini = {
      isConfigured: () => true,
      generateJson: vi.fn().mockResolvedValueOnce({
        text: JSON.stringify({
          approved: true,
          issues: [],
        }),
      }),
    };

    const critic = new GeminiCritic({ gemini: fakeGemini as any, enabled: true });
    const verdict = await critic.evaluateSections(weddingPuneFixture, {
      menu: { suggestions: [{ course: 'Mains', items: ['Paneer Tikka'] }] },
    });

    expect(verdict.approved).toBe(true);
    expect(verdict.issues).toHaveLength(0);
  });

  it('identifies issues and flags section when dietary or cultural mismatch is found', async () => {
    const fakeGemini = {
      isConfigured: () => true,
      generateJson: vi.fn().mockResolvedValueOnce({
        text: JSON.stringify({
          approved: false,
          issues: [
            {
              section: 'menu',
              problem:
                'Contains onion and garlic gravy in main courses despite 10 Jain guests present',
            },
          ],
        }),
      }),
    };

    const critic = new GeminiCritic({ gemini: fakeGemini as any, enabled: true });
    const verdict = await critic.evaluateSections(weddingPuneFixture, {
      menu: { suggestions: [{ course: 'Mains', items: ['Onion Gravy Paneer'] }] },
    });

    expect(verdict.approved).toBe(false);
    expect(verdict.issues).toHaveLength(1);
    expect(verdict.issues[0]?.section).toBe('menu');
    expect(verdict.issues[0]?.problem).toContain('10 Jain guests');
  });

  it('gracefully degrades to approved: true when critic API encounters an error or network failure', async () => {
    const fakeGemini = {
      isConfigured: () => true,
      generateJson: vi.fn().mockRejectedValueOnce(new Error('Network failure or timeout')),
    };

    const critic = new GeminiCritic({ gemini: fakeGemini as any, enabled: true });
    const verdict = await critic.evaluateSections(weddingPuneFixture, {
      menu: { suggestions: [] },
    });

    // Invariant: Critic failure NEVER blocks the user's response
    expect(verdict.approved).toBe(true);
    expect(verdict.issues).toEqual([]);
  });

  it('returns approved immediately when critic is disabled or unconfigured', async () => {
    const critic = new GeminiCritic({ enabled: false });
    expect(critic.isEnabled()).toBe(false);

    const verdict = await critic.evaluateSections(weddingPuneFixture, {});
    expect(verdict.approved).toBe(true);
    expect(verdict.issues).toEqual([]);
  });

  it('initializes with default options safely when no config is provided', () => {
    const critic = new GeminiCritic();
    expect(critic.isEnabled()).toBe(false);
  });

  it('handles invalid schema output from critic by defaulting to approved', async () => {
    const fakeGemini = {
      isConfigured: () => true,
      generateJson: vi.fn().mockResolvedValueOnce({
        text: '{"unrecognized_key": "bad_schema"}',
      }),
    };

    const critic = new GeminiCritic({ gemini: fakeGemini as any, enabled: true });
    const verdict = await critic.evaluateSections(weddingPuneFixture, {});

    expect(verdict.approved).toBe(true);
    expect(verdict.issues).toEqual([]);
  });
});
