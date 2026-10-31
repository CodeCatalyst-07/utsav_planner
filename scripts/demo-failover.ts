import { FailoverChain } from '../src/server/ai/chain';
import { JarvisProvider } from '../src/server/ai/jarvis';
import { GeminiProvider } from '../src/server/ai/gemini';
import { sectionSchemas } from '../src/server/ai/sections';
import { buildCategoryTipsPrompt } from '../src/server/ai/prompts';
import { DeterministicFallback } from '../src/server/ai/fallback';
import { weddingPuneFixture } from '../src/domain/fixtures/profiles';

async function main() {
  console.log('--- DEMO FAILOVER: Invalid Jarvis Key -> Gemini Answers Cleanly ---');

  const fs = await import('node:fs');
  const lines = fs.readFileSync('.env.local', 'utf-8').split('\n');
  let geminiKey = '';
  let geminiModel = 'gemini-2.5-flash';
  for (const line of lines) {
    if (line.startsWith('GEMINI_API_KEY=')) geminiKey = line.split('=')[1]?.trim() || '';
    if (line.startsWith('GEMINI_MODEL='))
      geminiModel = line.split('=')[1]?.trim() || 'gemini-2.5-flash';
  }

  const allowedCategoryIds = ['venue', 'catering', 'decor', 'photo_video', 'attire_jewellery'];

  const chain = new FailoverChain({
    jarvis: new JarvisProvider({
      apiKey: 'INVALID_JARVIS_KEY_DEMO',
      baseURL: 'https://models.jarvislabs.net/v1',
      model: 'gemma-4-31b-it',
      jsonMode: 'prompt_only',
      defaultTimeoutMs: 5000,
    }),
    gemini: new GeminiProvider({
      apiKey: geminiKey,
      model: geminiModel,
      defaultTimeoutMs: 15000,
    }),
  });

  const res = await chain.executeSection({
    section: 'category_tips',
    schema: sectionSchemas.category_tips,
    promptBuilder: () => buildCategoryTipsPrompt(weddingPuneFixture, allowedCategoryIds),
    fallbackGetter: () =>
      DeterministicFallback.getCategoryTips(weddingPuneFixture, allowedCategoryIds),
    validationContext: { profile: weddingPuneFixture, allowedCategoryIds },
    profile: weddingPuneFixture,
    requestId: 'demo_failover',
  });

  console.log('\nResponse Meta:');
  console.log(JSON.stringify(res.meta, null, 2));

  console.log('\nResponse Sample Tips:');
  console.log(JSON.stringify((res.data as any)?.tips?.slice(0, 2), null, 2));
}

main().catch((err) => {
  console.error('Failover demo failed:', err);
  process.exit(1);
});
