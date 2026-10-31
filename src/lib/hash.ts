/**
 * src/lib/hash.ts
 *
 * Deterministic client-safe hashing for cache keys.
 * Uses 32-bit FNV-1a algorithm to produce clean hexadecimal strings.
 * Never stores or exposes raw notes or personal text in storage keys.
 */

export function fnv1aHash(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    // Multiply by 32-bit FNV prime 0x01000193
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export async function sha256Hex(str: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  return fnv1aHash(str);
}

export function buildIdeasCacheKey(params: {
  eventType: string;
  cityName: string;
  guestCount: number;
  budgetTier: string;
  notes?: string;
}): string {
  const normalizedNotes = (params.notes || '').trim().toLowerCase();
  const notesHash = fnv1aHash(normalizedNotes);
  const inputTuple = `${params.eventType}:${params.cityName.toLowerCase()}:${params.guestCount}:${params.budgetTier}:${notesHash}`;
  return `utsav_ideas_${fnv1aHash(inputTuple)}`;
}

export function buildMenuCacheKey(params: {
  eventType: string;
  cityName?: string;
  guestCount: number;
  dietary?: Record<string, number>;
}): string {
  const dietaryStr = JSON.stringify(params.dietary || {});
  const city = (params.cityName || '').toLowerCase().trim();
  const inputTuple = `${params.eventType}:${city}:${params.guestCount}:${dietaryStr}`;
  return `utsav_menu_${fnv1aHash(inputTuple)}`;
}

export function buildCategoryTipsCacheKey(params: {
  eventType: string;
  cityName?: string;
  totalBudgetInr: number;
  guestCount: number;
}): string {
  const city = (params.cityName || '').toLowerCase().trim();
  const inputTuple = `${params.eventType}:${city}:${params.totalBudgetInr}:${params.guestCount}`;
  return `utsav_tips_${fnv1aHash(inputTuple)}`;
}
