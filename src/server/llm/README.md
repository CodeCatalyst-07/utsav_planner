# Server LLM Adapters (`src/server/llm`)

Contains the unified `LLMProvider` interface and concrete adapters:

- `GeminiProvider`: Google Gemini API integration using structured output / tool calling.
- `JarvisLabsProvider`: OpenAI-compatible client adapter connecting to JarvisLabs hosted models (e.g. Gemma 4 31B IT).

### Invariants:

- All external API calls, token counting, retry policies, and timeouts reside strictly in this directory.
- Domain rules never call LLM adapters directly.
