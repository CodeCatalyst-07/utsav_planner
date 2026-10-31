/**
 * src/lib/client-fetch.ts
 *
 * Client-side fetch wrapper for Utsav Planner API routes.
 * Handles AbortSignal, timeouts, friendly error mapping, and HTTP 429 Retry-After.
 */

export interface ClientApiError {
  isError: true;
  code: 'ABORTED' | 'RATE_LIMITED' | 'NETWORK_ERROR' | 'SERVER_ERROR' | 'VALIDATION_ERROR';
  message: string;
  retryAfterSeconds?: number;
}

export interface IdeasResponse {
  data: {
    themes: Array<{
      title: string;
      description: string;
    }>;
  };
  meta: {
    provider: 'jarvis' | 'gemini' | 'template' | string;
    durationMs?: number;
    cached?: boolean;
    fallbackReason?: string;
  };
}

export interface MenuResponse {
  data: {
    suggestions: Array<{
      course: string;
      items: string[];
    }>;
  };
  meta: {
    provider: 'jarvis' | 'gemini' | 'template' | string;
    durationMs?: number;
    cached?: boolean;
    fallbackReason?: string;
  };
}

export interface CategoryTipsResponse {
  data: {
    tips: Array<{
      categoryId: string;
      tip: string;
    }>;
  };
  meta: {
    provider: 'jarvis' | 'gemini' | 'template' | string;
    durationMs?: number;
    cached?: boolean;
    fallbackReason?: string;
  };
}

export interface ChatResponse {
  reply: string;
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
  plan?: unknown;
  meta?: {
    provider?: string;
    durationMs?: number;
    fallbackReason?: string;
  };
}

export interface VendorListingItem {
  id: string;
  name: string;
  area?: string;
  mapsUrl: string;
  badge: 'sample' | 'google_maps';
  note?: string;
}

export interface VendorsApiResponse {
  source: 'sample' | 'places';
  vendors: VendorListingItem[];
  mapsUrl: string;
}

export async function fetchAiIdeas(
  profile: unknown,
  signal?: AbortSignal
): Promise<{ ok: true; data: IdeasResponse } | { ok: false; error: ClientApiError }> {
  return postAiSection<IdeasResponse>('ideas', profile, signal);
}

export async function fetchAiMenu(
  profile: unknown,
  signal?: AbortSignal
): Promise<{ ok: true; data: MenuResponse } | { ok: false; error: ClientApiError }> {
  return postAiSection<MenuResponse>('menu', profile, signal);
}

export async function fetchAiCategoryTips(
  profile: unknown,
  signal?: AbortSignal
): Promise<{ ok: true; data: CategoryTipsResponse } | { ok: false; error: ClientApiError }> {
  return postAiSection<CategoryTipsResponse>('category_tips', profile, signal);
}

async function postAiSection<T>(
  section: string,
  profile: unknown,
  signal?: AbortSignal
): Promise<{ ok: true; data: T } | { ok: false; error: ClientApiError }> {
  try {
    const res = await fetch('/api/ai/section', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        section,
        profile,
      }),
      signal,
    });

    if (res.status === 429) {
      const retryHeader = res.headers.get('retry-after');
      const retrySeconds = retryHeader ? parseInt(retryHeader, 10) : 60;
      return {
        ok: false,
        error: {
          isError: true,
          code: 'RATE_LIMITED',
          message: `Generation rate limit reached. Please wait ~${retrySeconds} seconds before requesting new suggestions.`,
          retryAfterSeconds: isNaN(retrySeconds) ? 60 : retrySeconds,
        },
      };
    }

    if (!res.ok) {
      let errorMsg = `Server error (HTTP ${res.status})`;
      try {
        const json = await res.json();
        if (json?.error?.message) {
          errorMsg = json.error.message;
        }
      } catch {
        // use default error message
      }
      return {
        ok: false,
        error: {
          isError: true,
          code: res.status >= 500 ? 'SERVER_ERROR' : 'VALIDATION_ERROR',
          message: errorMsg,
        },
      };
    }

    const json = (await res.json()) as T;
    return { ok: true, data: json };
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return {
        ok: false,
        error: {
          isError: true,
          code: 'ABORTED',
          message: 'Idea generation was stopped.',
        },
      };
    }

    return {
      ok: false,
      error: {
        isError: true,
        code: 'NETWORK_ERROR',
        message: 'Unable to reach the server. Please check your network connection.',
      },
    };
  }
}

export async function fetchAiChat(
  profile: unknown,
  message: string,
  signal?: AbortSignal
): Promise<{ ok: true; data: ChatResponse } | { ok: false; error: ClientApiError }> {
  try {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        profile,
        message,
      }),
      signal,
    });

    if (res.status === 429) {
      const retryHeader = res.headers.get('retry-after');
      const retrySeconds = retryHeader ? parseInt(retryHeader, 10) : 60;
      return {
        ok: false,
        error: {
          isError: true,
          code: 'RATE_LIMITED',
          message: `Assistant is busy. Please wait ~${retrySeconds} seconds before sending another message.`,
          retryAfterSeconds: isNaN(retrySeconds) ? 60 : retrySeconds,
        },
      };
    }

    if (!res.ok) {
      let errorMsg = `Server error (HTTP ${res.status})`;
      try {
        const json = await res.json();
        if (json?.error?.message) {
          errorMsg = json.error.message;
        }
      } catch {}
      return {
        ok: false,
        error: {
          isError: true,
          code: res.status >= 500 ? 'SERVER_ERROR' : 'VALIDATION_ERROR',
          message: errorMsg,
        },
      };
    }

    const json = (await res.json()) as ChatResponse;
    return { ok: true, data: json };
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return {
        ok: false,
        error: {
          isError: true,
          code: 'ABORTED',
          message: 'Request was cancelled.',
        },
      };
    }

    return {
      ok: false,
      error: {
        isError: true,
        code: 'NETWORK_ERROR',
        message: 'Unable to reach the server. Please check your network connection.',
      },
    };
  }
}

export async function fetchVendors(
  params: {
    categoryId: string;
    city?: string;
    tier?: string;
    label?: string;
  },
  signal?: AbortSignal
): Promise<{ ok: true; data: VendorsApiResponse } | { ok: false; error: ClientApiError }> {
  try {
    const searchParams = new URLSearchParams();
    searchParams.set('categoryId', params.categoryId);
    if (params.city) searchParams.set('city', params.city);
    if (params.tier) searchParams.set('tier', params.tier);
    if (params.label) searchParams.set('label', params.label);

    const res = await fetch(`/api/vendors?${searchParams.toString()}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal,
    });

    if (res.status === 429) {
      const retryHeader = res.headers.get('retry-after');
      const retrySeconds = retryHeader ? parseInt(retryHeader, 10) : 60;
      return {
        ok: false,
        error: {
          isError: true,
          code: 'RATE_LIMITED',
          message: `Too many vendor lookups. Please wait ~${retrySeconds} seconds.`,
          retryAfterSeconds: isNaN(retrySeconds) ? 60 : retrySeconds,
        },
      };
    }

    if (!res.ok) {
      let errorMsg = `Server error (HTTP ${res.status})`;
      try {
        const json = await res.json();
        if (json?.error?.message) {
          errorMsg = json.error.message;
        }
      } catch {}
      return {
        ok: false,
        error: {
          isError: true,
          code: res.status >= 500 ? 'SERVER_ERROR' : 'VALIDATION_ERROR',
          message: errorMsg,
        },
      };
    }

    const json = (await res.json()) as VendorsApiResponse;
    return { ok: true, data: json };
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return {
        ok: false,
        error: {
          isError: true,
          code: 'ABORTED',
          message: 'Vendor lookup was aborted.',
        },
      };
    }

    return {
      ok: false,
      error: {
        isError: true,
        code: 'NETWORK_ERROR',
        message: 'Unable to connect to vendor service.',
      },
    };
  }
}
