/**
 * PII (Personally Identifiable Information) detection & redaction utilities.
 * Protects user privacy by warning in UI and redacting contact details (phone, email)
 * before sending untrusted user notes to third-party LLM providers.
 */

export const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
export const PHONE_PATTERN =
  /(?:(?:\+|00)?91[\s.-]*)?[6-9]\d{4}[\s.-]?\d{5}\b|\b[6-9]\d{9}\b|\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/;

/**
 * Checks whether text contains phone numbers or email addresses.
 */
export function containsPii(text?: string | null): boolean {
  if (!text) return false;
  return EMAIL_PATTERN.test(text) || PHONE_PATTERN.test(text);
}

/**
 * Replaces phone numbers and email addresses with '[removed]'.
 */
export function redactPii(text: string): string {
  const emailGlobal = new RegExp(EMAIL_PATTERN.source, 'gi');
  const phoneGlobal = new RegExp(PHONE_PATTERN.source, 'g');
  return text.replace(emailGlobal, '[removed]').replace(phoneGlobal, '[removed]');
}
