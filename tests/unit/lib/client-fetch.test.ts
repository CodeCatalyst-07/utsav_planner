import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchAiIdeas,
  fetchAiMenu,
  fetchAiCategoryTips,
  fetchAiChat,
  fetchVendors,
} from '@/lib/client-fetch';
import { BRAND_NAME, BRAND_TAGLINE, BRAND_DISCLAIMER } from '@/lib/brand';

describe('Brand Constants (src/lib/brand.ts)', () => {
  it('exports valid brand strings', () => {
    expect(BRAND_NAME).toBe('Utsav Planner');
    expect(BRAND_TAGLINE).toBeDefined();
    expect(BRAND_DISCLAIMER).toBeDefined();
  });
});

describe('Client Fetch Wrapper (src/lib/client-fetch.ts)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns data when API responds with 200 for ideas, menu, and tips', async () => {
    const mockIdeas = {
      data: { themes: [{ title: 'Royal', description: 'Heritage style' }] },
      meta: { provider: 'jarvis', durationMs: 120 },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockIdeas,
    });

    const resIdeas = await fetchAiIdeas({ eventType: 'wedding' });
    expect(resIdeas.ok).toBe(true);

    const mockMenu = {
      data: { suggestions: [{ course: 'Welcome Drinks', items: ['Aam Panna'] }] },
      meta: { provider: 'gemini', durationMs: 110 },
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockMenu,
    });
    const resMenu = await fetchAiMenu({ eventType: 'wedding' });
    expect(resMenu.ok).toBe(true);

    const mockTips = {
      data: { tips: [{ categoryId: 'catering', tip: 'Lock vegetables early' }] },
      meta: { provider: 'template', durationMs: 20 },
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockTips,
    });
    const resTips = await fetchAiCategoryTips({ eventType: 'wedding' });
    expect(resTips.ok).toBe(true);
  });

  it('handles fetchAiChat success, proposal parsing, and errors', async () => {
    const mockChat = {
      reply: 'I can adjust your guests to 150.',
      patch: { guestCount: 150 },
      diff: {
        summaryFacts: ['Guests reduced to 150'],
        totalDelta: 0,
        cateringEstimateDelta: -200000,
      },
      meta: { provider: 'jarvis' },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockChat,
    });

    const res = await fetchAiChat({ eventType: 'wedding' }, 'Reduce guests to 150');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.reply).toBe('I can adjust your guests to 150.');
      expect(res.data.patch?.guestCount).toBe(150);
    }

    // Chat 429
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Headers({ 'retry-after': '30' }),
      json: async () => ({ error: { message: 'Too Many Requests' } }),
    });
    const res429 = await fetchAiChat({ eventType: 'wedding' }, 'hi');
    expect(res429.ok).toBe(false);
    if (!res429.ok) {
      expect(res429.error.code).toBe('RATE_LIMITED');
      expect(res429.error.retryAfterSeconds).toBe(30);
    }

    // Chat Abort
    const abortErr = new DOMException('The operation was aborted', 'AbortError');
    global.fetch = vi.fn().mockRejectedValue(abortErr);
    const resAbort = await fetchAiChat({ eventType: 'wedding' }, 'hi');
    expect(resAbort.ok).toBe(false);
    if (!resAbort.ok) {
      expect(resAbort.error.code).toBe('ABORTED');
    }

    // Chat 500
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: 'Chat engine failure' } }),
    });
    const res500 = await fetchAiChat({ eventType: 'wedding' }, 'hi');
    expect(res500.ok).toBe(false);
    if (!res500.ok) {
      expect(res500.error.code).toBe('SERVER_ERROR');
    }

    // Chat Network Error
    global.fetch = vi.fn().mockRejectedValue(new Error('Network drop'));
    const resNet = await fetchAiChat({ eventType: 'wedding' }, 'hi');
    expect(resNet.ok).toBe(false);
    if (!resNet.ok) {
      expect(resNet.error.code).toBe('NETWORK_ERROR');
    }
  });

  it('handles fetchVendors query construction, 200 response, and errors', async () => {
    const mockVendors = {
      source: 'places',
      vendors: [
        {
          id: 'v1',
          name: 'Grand Lawns',
          mapsUrl: 'https://maps.google.com',
          badge: 'sample',
        },
      ],
      mapsUrl: 'https://maps.google.com/search',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockVendors,
    });

    const res = await fetchVendors({
      categoryId: 'venue',
      city: 'Pune',
      tier: 'tier1',
      label: 'Wedding Venues',
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.vendors[0]?.name).toBe('Grand Lawns');
    }

    // 429
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Headers({ 'retry-after': '20' }),
      json: async () => ({}),
    });
    const res429 = await fetchVendors({ categoryId: 'venue' });
    expect(res429.ok).toBe(false);
    if (!res429.ok) {
      expect(res429.error.code).toBe('RATE_LIMITED');
      expect(res429.error.retryAfterSeconds).toBe(20);
    }

    // 500
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: 'Vendors lookup failed' } }),
    });
    const res500 = await fetchVendors({ categoryId: 'venue' });
    expect(res500.ok).toBe(false);
    if (!res500.ok) {
      expect(res500.error.code).toBe('SERVER_ERROR');
    }

    // Abort
    const abortErr = new DOMException('The operation was aborted', 'AbortError');
    global.fetch = vi.fn().mockRejectedValue(abortErr);
    const resAbort = await fetchVendors({ categoryId: 'venue' });
    expect(resAbort.ok).toBe(false);
    if (!resAbort.ok) {
      expect(resAbort.error.code).toBe('ABORTED');
    }

    // Network error
    global.fetch = vi.fn().mockRejectedValue(new Error('Network drop'));
    const resNet = await fetchVendors({ categoryId: 'venue' });
    expect(resNet.ok).toBe(false);
    if (!resNet.ok) {
      expect(resNet.error.code).toBe('NETWORK_ERROR');
    }
  });

  it('correctly maps HTTP 429 with Retry-After header to friendly error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Headers({ 'retry-after': '45' }),
      text: async () => 'Too Many Requests',
    });

    const res = await fetchAiIdeas({ eventType: 'wedding' });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('RATE_LIMITED');
      expect(res.error.retryAfterSeconds).toBe(45);
      expect(res.error.message).toContain('45 seconds');
    }
  });

  it('correctly maps AbortError when request is cancelled by user', async () => {
    const abortErr = new DOMException('The operation was aborted', 'AbortError');
    global.fetch = vi.fn().mockRejectedValue(abortErr);

    const controller = new AbortController();
    const res = await fetchAiIdeas({ eventType: 'wedding' }, controller.signal);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('ABORTED');
      expect(res.error.message).toContain('stopped');
    }
  });

  it('maps HTTP 500 server error to clean message', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: 'Upstream generation failure' } }),
    });

    const res = await fetchAiIdeas({ eventType: 'wedding' });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('SERVER_ERROR');
      expect(res.error.message).toBe('Upstream generation failure');
    }
  });

  it('maps network disconnect or connection failure', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

    const res = await fetchAiIdeas({ eventType: 'wedding' });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('NETWORK_ERROR');
      expect(res.error.message).toContain('network connection');
    }
  });
});
