import { describe, it, expect } from 'vitest';
import { extractJsonObject } from '@/server/ai/jsonExtract';

describe('JSON Object Extractor (src/server/ai/jsonExtract.ts)', () => {
  it('parses clean valid JSON string', () => {
    const raw = '{"themes": [{"title": "Royal Heritage", "description": "Classic theme"}]}';
    const result = extractJsonObject(raw) as any;
    expect(result.themes).toHaveLength(1);
    expect(result.themes[0].title).toBe('Royal Heritage');
  });

  it('strips markdown ```json code fences', () => {
    const raw = '```json\n{"status": "ok", "count": 42}\n```';
    const result = extractJsonObject(raw) as any;
    expect(result.status).toBe('ok');
    expect(result.count).toBe(42);
  });

  it('strips generic ``` code fences', () => {
    const raw = '```\n{"approved": true}\n```';
    const result = extractJsonObject(raw) as any;
    expect(result.approved).toBe(true);
  });

  it('extracts JSON object when surrounded by conversational filler text', () => {
    const raw =
      'Here is your generated theme plan for Pune:\n\n{"title": "Festive Mela"}\n\nHope this celebration brings immense joy!';
    const result = extractJsonObject(raw) as any;
    expect(result.title).toBe('Festive Mela');
  });

  it('tolerates trailing commas in objects and arrays', () => {
    const raw = `
      {
        "themes": [
          {"title": "Theme 1",},
          {"title": "Theme 2",},
        ],
        "active": true,
      }
    `;
    const result = extractJsonObject(raw) as any;
    expect(result.themes).toHaveLength(2);
    expect(result.active).toBe(true);
  });

  it('correctly handles nested curly braces inside string values', () => {
    const raw = '{"note": "Special format {like this} in text", "valid": true}';
    const result = extractJsonObject(raw) as any;
    expect(result.note).toBe('Special format {like this} in text');
    expect(result.valid).toBe(true);
  });

  it('correctly handles escaped quotes inside strings', () => {
    const raw = '{"quote": "He said \\"Namaste\\" to all guests", "count": 1}';
    const result = extractJsonObject(raw) as any;
    expect(result.quote).toBe('He said "Namaste" to all guests');
  });

  it('throws an error when no opening brace exists', () => {
    expect(() => extractJsonObject('Just plain conversational text with no JSON.')).toThrow(
      /opening brace "{"/
    );
  });

  it('throws an error on truncated or unbalanced JSON', () => {
    expect(() => extractJsonObject('{"themes": [{"title": "Incomplete"')).toThrow(
      /Unbalanced or truncated/
    );
  });

  it('throws an error for non-string or empty input', () => {
    expect(() => extractJsonObject('')).toThrow(/empty or not a string/);
    expect(() => extractJsonObject(null as any)).toThrow(/empty or not a string/);
  });
});
