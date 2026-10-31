import { describe, it, expect, vi } from 'vitest';
import { GeminiGrounding } from '@/server/ai/grounding';

describe('Gemini Google Search Grounding (src/server/ai/grounding.ts)', () => {
  it('returns null immediately when grounding is disabled', async () => {
    const grounding = new GeminiGrounding({ enabled: false });
    expect(grounding.isEnabled()).toBe(false);

    const result = await grounding.lookupFestivalInfo('Diwali', 2027);
    expect(result).toBeNull();
  });

  it('extracts grounded search summary and sources with mandatory disclaimer when enabled', async () => {
    const fakeClient = {
      models: {
        generateContent: vi.fn().mockResolvedValueOnce({
          text: 'Ganesh Chaturthi in 2027 will be celebrated starting September 4 across Maharashtra and India.',
          candidates: [
            {
              groundingMetadata: {
                groundingChunks: [
                  {
                    web: {
                      title: 'Panchang 2027 Calendar',
                      uri: 'https://panchang.example.com/ganesh-chaturthi-2027',
                    },
                  },
                ],
              },
            },
          ],
        }),
      },
    };

    const grounding = new GeminiGrounding({
      client: fakeClient as any,
      model: 'gemini-2.5-flash',
      enabled: true,
    });

    const result = await grounding.lookupFestivalInfo('Ganesh Chaturthi', 2027);
    expect(result).not.toBeNull();
    expect(result?.summary).toContain('September 4');
    expect(result?.sources).toHaveLength(1);
    expect(result?.sources[0]?.url).toBe('https://panchang.example.com/ganesh-chaturthi-2027');
    expect(result?.disclaimer).toContain('confirm specific muhurat timings');
  });

  it('gracefully degrades to null on network or quota errors', async () => {
    const fakeClient = {
      models: {
        generateContent: vi.fn().mockRejectedValueOnce(new Error('Quota exceeded')),
      },
    };

    const grounding = new GeminiGrounding({
      client: fakeClient as any,
      model: 'gemini-2.5-flash',
      enabled: true,
    });

    const result = await grounding.lookupFestivalInfo('Holi', 2027);
    expect(result).toBeNull();
  });
});
