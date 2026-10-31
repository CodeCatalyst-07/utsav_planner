import 'server-only';

/**
 * Extracts the incoming request ID from headers (e.g. x-request-id)
 * or generates a fresh cryptographically random ID.
 */
export function getOrCreateRequestId(headers?: Headers): string {
  if (headers) {
    const existing = headers.get('x-request-id') || headers.get('x-correlation-id');
    if (existing && existing.trim().length > 0) {
      // Sanitize: allow alphanumeric, dash, underscore, max 64 chars
      const sanitized = existing
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .slice(0, 64);
      if (sanitized.length > 0) {
        return sanitized;
      }
    }
  }

  return `req_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
}
