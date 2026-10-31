import 'server-only';

/**
 * Pure helper to build zero-billing Google Maps search URLs.
 * Format: https://www.google.com/maps/search/?api=1&query=<encoded "label in city">
 */
export function buildGoogleMapsSearchUrl(label: string, city?: string): string {
  const location = city && city.trim().length > 0 ? city.trim() : 'India';
  const query = `${label.trim()} in ${location}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
