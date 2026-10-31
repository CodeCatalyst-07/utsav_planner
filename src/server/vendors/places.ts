import 'server-only';
import { Vendor, VendorSearchQuery, VendorSearchResult, VendorSource } from './source';
import { SampleVendorSource } from './sample';
import { buildGoogleMapsSearchUrl } from './mapsLinks';
import { getEnv } from '@/server/env';
import { logger } from '@/server/security/logger';

export interface PlacesVendorSourceOptions {
  apiKey?: string;
  fetchFn?: typeof fetch;
  sampleFallback?: SampleVendorSource;
  timeoutMs?: number;
  includeRating?: boolean; // Default false to avoid higher-priced Places API SKU
}

interface PlaceItem {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  googleMapsUri?: string;
  rating?: number;
}

/**
 * Adapter for Google Places API (New) Text Search.
 * Follows Google Maps Platform Terms of Service:
 * - Place IDs can be stored indefinitely.
 * - Place details are cached ephemerally (max 30 days).
 * - On network or quota error, gracefully falls back to SampleVendorSource with universal Google Maps search URL.
 */
export class PlacesVendorSource implements VendorSource {
  private readonly apiKey?: string;
  private readonly fetchFn: typeof fetch;
  private readonly sampleFallback: SampleVendorSource;
  private readonly timeoutMs: number;
  private readonly includeRating: boolean;

  // Ephemeral in-memory place details cache
  private static readonly detailsCache = new Map<
    string,
    { vendors: Vendor[]; expiresAt: number }
  >();

  public static clearCache(): void {
    PlacesVendorSource.detailsCache.clear();
  }

  constructor(options?: PlacesVendorSourceOptions) {
    this.fetchFn = options?.fetchFn ?? fetch;
    this.sampleFallback = options?.sampleFallback ?? new SampleVendorSource();
    this.timeoutMs = options?.timeoutMs ?? 10_000;
    this.includeRating = options?.includeRating ?? false;

    if (options?.apiKey) {
      this.apiKey = options.apiKey;
    } else {
      try {
        const env = getEnv();
        this.apiKey = env.GOOGLE_PLACES_API_KEY;
      } catch {
        this.apiKey = undefined;
      }
    }
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async search(query: VendorSearchQuery): Promise<VendorSearchResult> {
    const mapsUrl = buildGoogleMapsSearchUrl(query.label, query.cityName);

    if (!this.isConfigured()) {
      return this.sampleFallback.search(query);
    }

    const city =
      query.cityName && query.cityName.trim().length > 0 ? query.cityName.trim() : 'India';
    const textQuery = `${query.label.trim()} in ${city}`;
    const cacheKey = `${query.categoryId}:${textQuery.toLowerCase()}`;

    // Check ephemeral cache
    const cached = PlacesVendorSource.detailsCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return {
        source: 'places',
        vendors: cached.vendors,
        mapsUrl,
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    // Minimal field mask to stay within lower-cost Basic Data SKU
    let fieldMask = 'places.id,places.displayName,places.formattedAddress,places.googleMapsUri';
    if (this.includeRating) {
      fieldMask += ',places.rating';
    }

    try {
      const response = await this.fetchFn('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey!,
          'X-Goog-FieldMask': fieldMask,
        },
        body: JSON.stringify({
          textQuery,
          pageSize: 5,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        logger.warn({
          requestId: 'places_search',
          route: 'vendors',
          status: response.status,
          message: `Google Places API returned HTTP ${response.status}; falling back to sample listings`,
        });
        return this.sampleFallback.search(query);
      }

      const data = (await response.json()) as { places?: PlaceItem[] };
      const rawPlaces = data.places || [];

      if (rawPlaces.length === 0) {
        return this.sampleFallback.search(query);
      }

      const vendors: Vendor[] = rawPlaces.slice(0, 5).map((place) => ({
        id: place.id,
        name: place.displayName?.text || query.label,
        area: place.formattedAddress,
        rating: place.rating,
        mapsUrl: place.googleMapsUri || mapsUrl,
        badge: 'google_maps',
      }));

      // Cache details ephemerally for 1 hour (well within Google's 30-day max caching limit)
      PlacesVendorSource.detailsCache.set(cacheKey, {
        vendors,
        expiresAt: Date.now() + 3_600_000,
      });

      return {
        source: 'places',
        vendors,
        mapsUrl,
      };
    } catch (err: unknown) {
      logger.warn({
        requestId: 'places_search',
        route: 'vendors',
        status: 'warn',
        message: `Google Places search exception: ${(err as Error).message}; falling back to sample listings`,
      });
      return this.sampleFallback.search(query);
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
