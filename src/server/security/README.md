# Server Security Layer (`src/server/security`)

Security guards and request sanitizers:

- In-memory / Vercel KV rate limiting based on client IP (`RATE_LIMIT_PER_MIN`).
- Prompt injection protection and input sanitizers before dispatching user input to LLM adapters.
- Output redaction preventing secret or token leakage.
