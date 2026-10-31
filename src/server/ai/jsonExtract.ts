import 'server-only';

/**
 * Extracts and parses a balanced JSON object from raw LLM output text.
 * Strips markdown code fences, removes trailing commas, finds the first
 * balanced '{ ... }' block (respecting quotes and escapes), and parses it safely.
 * NEVER uses eval().
 */
export function extractJsonObject(raw: string): unknown {
  if (!raw || typeof raw !== 'string') {
    throw new Error('Input text is empty or not a string');
  }

  // 1. Strip markdown code fences if present
  let cleaned = raw.replace(/```(?:json)?\s*([\s\S]*?)\s*```/i, '$1').trim();

  // 2. Locate first opening brace '{'
  const firstBraceIndex = cleaned.indexOf('{');
  if (firstBraceIndex === -1) {
    throw new Error('No JSON object opening brace "{" found in output');
  }

  // 3. Find the matching closing brace '}' tracking string quotes and escapes
  let depth = 0;
  let inString = false;
  let isEscaped = false;
  let closingBraceIndex = -1;

  for (let i = firstBraceIndex; i < cleaned.length; i++) {
    const char = cleaned[i];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (char === '\\') {
        isEscaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0) {
        closingBraceIndex = i;
        break;
      }
    }
  }

  if (closingBraceIndex === -1 || depth !== 0) {
    throw new Error('Unbalanced or truncated JSON object in output');
  }

  let jsonSubstring = cleaned.slice(firstBraceIndex, closingBraceIndex + 1);

  // 4. Tolerate trailing commas before } or ]
  jsonSubstring = jsonSubstring.replace(/,\s*([}\]])/g, '$1');

  try {
    return JSON.parse(jsonSubstring);
  } catch (err) {
    throw new Error(`Failed to parse extracted JSON object: ${(err as Error).message}`);
  }
}
