import { env } from '@/lib/env';
import { createAnthropicProvider } from './providers/anthropic';
import type { AIProvider } from './provider';

/** Provider selection (Architecture §8) — env-driven, never hardcoded to one vendor. */
function buildProvider(): AIProvider {
  switch (env.AI_PROVIDER) {
    case 'anthropic':
      return createAnthropicProvider(env.ANTHROPIC_API_KEY);
    case 'openai':
      throw new Error('OpenAI provider not implemented yet');
    default:
      throw new Error(`Unknown AI_PROVIDER: ${env.AI_PROVIDER}`);
  }
}

export const aiProvider = buildProvider();

export * from './provider';
export * from './commands';
