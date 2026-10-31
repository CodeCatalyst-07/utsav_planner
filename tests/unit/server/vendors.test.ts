import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SampleVendorSource } from '@/server/vendors/sample';
import { PlacesVendorSource } from '@/server/vendors/places';
import { buildGoogleMapsSearchUrl } from '@/server/vendors/mapsLinks';
import { getVendorSource } from '@/server/vendors';

describe('Vendor Sources & Google Maps Integration (src/server/vendors/)', () => {
  beforeEach(() => {
    PlacesVendorSource.clearCache();
  });
  it('builds zero-billing Google Maps search URL with proper query encoding', () => {
    const url = buildGoogleMapsSearchUrl('Catering & Beverages', 'Pune');
    expect(url).toBe(
      'https://www.google.com/maps/search/?api=1&query=Catering%20%26%20Beverages%20in%20Pune'
    );

    const defaultUrl = buildGoogleMapsSearchUrl('Mandap Decorators');
    expect(defaultUrl).toBe(
      'https://www.google.com/maps/search/?api=1&query=Mandap%20Decorators%20in%20India'
    );
  });

  describe('SampleVendorSource (Default Zero-Cost)', () => {
    const sampleSource = new SampleVendorSource();

    it('returns fictional placeholder listings always carrying the sample badge and disclaimer', async () => {
      const result = await sampleSource.search({
        categoryId: 'catering',
        label: 'Catering & Beverages',
        cityName: 'Pune',
        cityTier: 'tier1',
      });

      expect(result.source).toBe('sample');
      expect(result.vendors.length).toBeGreaterThanOrEqual(3);
      expect(result.mapsUrl).toContain('google.com/maps/search');

      for (const vendor of result.vendors) {
        expect(vendor.badge).toBe('sample');
        expect(vendor.name).toMatch(/^Sample\s+/);
        expect(vendor.note).toContain('Sample listing, not a real business');
        expect(vendor.mapsUrl).toBe(result.mapsUrl);
      }
    });

    it('exposes no rating field on sample vendors and returns the exact disclaimer', async () => {
      const result = await sampleSource.search({
        categoryId: 'venue',
        label: 'Venue & Accommodation',
        cityName: 'Pune',
      });

      expect(result.vendors.length).toBeGreaterThanOrEqual(3);
      for (const vendor of result.vendors) {
        expect((vendor as any).rating).toBeUndefined();
        expect(vendor.note).toBe(
          'Sample listing, not a real business. Use the Google Maps link to find real vendors.'
        );
      }
    });

    it('provides localized placeholder entries for major Indian cities', async () => {
      const cities = ['Pune', 'Mumbai', 'Indore', 'Delhi NCR', 'Bengaluru', 'Hyderabad', 'Chennai'];

      for (const city of cities) {
        const result = await sampleSource.search({
          categoryId: 'venue',
          label: 'Venue & Lawns',
          cityName: city,
        });
        expect(result.vendors.length).toBeGreaterThanOrEqual(3);
        expect(
          result.vendors.some((v) =>
            v.name.toLowerCase().includes(city.toLowerCase().split(' ')[0]!)
          )
        ).toBe(true);
      }
    });

    it('falls back gracefully to generic placeholders for unsupported cities', async () => {
      const result = await sampleSource.search({
        categoryId: 'caterer',
        label: 'Catering',
        cityName: 'NonExistentCity123',
      });

      expect(result.vendors.length).toBeGreaterThanOrEqual(3);
      expect(result.vendors[0]?.badge).toBe('sample');
    });
  });

  describe('PlacesVendorSource (Google Places API Adapter)', () => {
    it('executes text search with minimal field mask headers and maps to google_maps badge', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          places: [
            {
              id: 'ChIJ12345',
              displayName: { text: 'Real Caterer Banquet Pune' },
              formattedAddress: 'Baner, Pune, Maharashtra',
              googleMapsUri: 'https://maps.google.com/?cid=12345',
              rating: 4.8,
            },
          ],
        }),
      });

      const placesSource = new PlacesVendorSource({
        apiKey: 'test-google-places-key',
        fetchFn: mockFetch as any,
      });

      const result = await placesSource.search({
        categoryId: 'catering',
        label: 'Caterers',
        cityName: 'Pune',
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0]!;
      expect(url).toBe('https://places.googleapis.com/v1/places:searchText');
      expect(init.headers['X-Goog-Api-Key']).toBe('test-google-places-key');
      expect(init.headers['X-Goog-FieldMask']).toContain('places.id');
      expect(init.headers['X-Goog-FieldMask']).toContain('places.displayName');

      expect(result.source).toBe('places');
      expect(result.vendors).toHaveLength(1);
      expect(result.vendors[0]?.name).toBe('Real Caterer Banquet Pune');
      expect(result.vendors[0]?.badge).toBe('google_maps');
      expect(result.vendors[0]?.mapsUrl).toBe('https://maps.google.com/?cid=12345');
    });

    it('falls back to sample listings and universal maps link when Places API returns 429 or 500', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      });

      const placesSource = new PlacesVendorSource({
        apiKey: 'test-google-places-key',
        fetchFn: mockFetch as any,
      });

      const result = await placesSource.search({
        categoryId: 'catering',
        label: 'Caterers',
        cityName: 'Pune',
      });

      // Seamless fallback to sample data
      expect(result.source).toBe('sample');
      expect(result.vendors.length).toBeGreaterThanOrEqual(3);
      expect(result.vendors[0]?.badge).toBe('sample');
      expect(result.mapsUrl).toContain('google.com/maps/search');
    });

    it('falls back to sample listings when Places API returns zero results', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ places: [] }),
      });

      const placesSource = new PlacesVendorSource({
        apiKey: 'test-google-places-key',
        fetchFn: mockFetch as any,
      });

      const result = await placesSource.search({
        categoryId: 'venue',
        label: 'Obscure Venue',
        cityName: 'RemoteVillage',
      });

      expect(result.source).toBe('sample');
      expect(result.vendors.length).toBeGreaterThanOrEqual(3);
    });

    it('falls back to sample listings when Places API encounters a network or timeout exception', async () => {
      const mockFetch = vi.fn().mockRejectedValueOnce(new Error('Network connection timeout'));

      const placesSource = new PlacesVendorSource({
        apiKey: 'test-google-places-key',
        fetchFn: mockFetch as any,
      });

      const result = await placesSource.search({
        categoryId: 'decorator',
        label: 'Decorators',
        cityName: 'Indore',
      });

      expect(result.source).toBe('sample');
      expect(result.vendors.length).toBeGreaterThanOrEqual(3);
    });

    it('falls back to sample listings when Places API is not configured', async () => {
      const placesSource = new PlacesVendorSource({ apiKey: '' });
      expect(placesSource.isConfigured()).toBe(false);

      const result = await placesSource.search({
        categoryId: 'venue',
        label: 'Banquet Hall',
        cityName: 'Pune',
      });

      expect(result.source).toBe('sample');
      expect(result.vendors.length).toBeGreaterThanOrEqual(3);
    });

    it('serves repeat places queries from ephemeral details cache', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          places: [
            {
              id: 'ChIJ_cached',
              displayName: { text: 'Cached Vendor' },
              formattedAddress: 'Pune',
              googleMapsUri: 'https://maps.google.com/1',
            },
          ],
        }),
      });

      const placesSource = new PlacesVendorSource({
        apiKey: 'test-key',
        fetchFn: mockFetch as any,
      });

      const res1 = await placesSource.search({
        categoryId: 'venue',
        label: 'Lawn',
        cityName: 'Pune',
      });
      expect(res1.source).toBe('places');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const res2 = await placesSource.search({
        categoryId: 'venue',
        label: 'Lawn',
        cityName: 'Pune',
      });
      expect(res2.source).toBe('places');
      expect(res2.vendors[0]?.name).toBe('Cached Vendor');
      expect(mockFetch).toHaveBeenCalledTimes(1); // Cached, no second network call
    });

    it('includes places.rating in fieldMask when includeRating option is true', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ places: [] }),
      });

      const placesSource = new PlacesVendorSource({
        apiKey: 'test-key',
        includeRating: true,
        fetchFn: mockFetch as any,
      });

      await placesSource.search({
        categoryId: 'venue',
        label: 'Banquet',
        cityName: 'Pune',
      });

      const [, init] = mockFetch.mock.calls[0]!;
      expect(init.headers['X-Goog-FieldMask']).toContain('places.rating');
    });

    it('handles missing place fields by falling back to query.label and mapsUrl', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          places: [
            {
              id: 'ChIJ_sparse',
              // no displayName, no googleMapsUri, no formattedAddress
            },
          ],
        }),
      });

      const placesSource = new PlacesVendorSource({
        apiKey: 'test-key',
        fetchFn: mockFetch as any,
      });

      const res = await placesSource.search({
        categoryId: 'caterer',
        label: 'Fallback Caterer',
        // undefined cityName
      });

      expect(res.source).toBe('places');
      expect(res.vendors[0]?.name).toBe('Fallback Caterer');
      expect(res.vendors[0]?.mapsUrl).toContain('google.com/maps/search');
    });
  });

  describe('getVendorSource Factory', () => {
    it('returns SampleVendorSource when VENDOR_SOURCE is sample (default)', () => {
      const source = getVendorSource({
        NODE_ENV: 'test',
        JARVIS_BASE_URL: '',
        JARVIS_MODEL: '',
        JARVIS_JSON_MODE: 'prompt_only',
        JARVIS_EXTRA_BODY_JSON: {},
        RATE_LIMIT_PER_MIN: 10,
        LLM_TIMEOUT_MS: 20000,
        AI_CACHE_TTL_SECONDS: 1800,
        AI_TOTAL_DEADLINE_MS: 15000,
        GEMINI_THINKING_BUDGET: undefined,
        CRITIC_ENABLED: true,
        GROUNDING_ENABLED: false,
        ALLOW_PROVIDER_OVERRIDE: false,
        VENDOR_SOURCE: 'sample',
      });

      expect(source).toBeInstanceOf(SampleVendorSource);
    });

    it('returns PlacesVendorSource when VENDOR_SOURCE is places and key is set', () => {
      const source = getVendorSource({
        NODE_ENV: 'test',
        JARVIS_BASE_URL: '',
        JARVIS_MODEL: '',
        JARVIS_JSON_MODE: 'prompt_only',
        JARVIS_EXTRA_BODY_JSON: {},
        RATE_LIMIT_PER_MIN: 10,
        LLM_TIMEOUT_MS: 20000,
        AI_CACHE_TTL_SECONDS: 1800,
        AI_TOTAL_DEADLINE_MS: 15000,
        GEMINI_THINKING_BUDGET: undefined,
        CRITIC_ENABLED: true,
        GROUNDING_ENABLED: false,
        ALLOW_PROVIDER_OVERRIDE: false,
        VENDOR_SOURCE: 'places',
        GOOGLE_PLACES_API_KEY: 'places-api-key-test',
      });

      expect(source).toBeInstanceOf(PlacesVendorSource);
    });
  });
});
