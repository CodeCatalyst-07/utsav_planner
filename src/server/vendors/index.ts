import 'server-only';
import { VendorSource } from './source';
import { SampleVendorSource } from './sample';
import { PlacesVendorSource } from './places';
import { EnvConfig, getEnv } from '@/server/env';

export * from './source';
export * from './sample';
export * from './places';
export * from './mapsLinks';

/**
 * Factory creating the active VendorSource adapter based on application environment configuration.
 * Dependency injection: accepts env and fetchFn for test mocking.
 */
export function getVendorSource(envConfig?: EnvConfig, fetchFn?: typeof fetch): VendorSource {
  let env: EnvConfig;
  try {
    env = envConfig ?? getEnv();
  } catch {
    return new SampleVendorSource();
  }

  if (env.VENDOR_SOURCE === 'places' && env.GOOGLE_PLACES_API_KEY) {
    return new PlacesVendorSource({
      apiKey: env.GOOGLE_PLACES_API_KEY,
      fetchFn,
    });
  }

  return new SampleVendorSource();
}
