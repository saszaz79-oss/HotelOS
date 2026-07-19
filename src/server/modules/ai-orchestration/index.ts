import { env } from '@/lib/env';
import { createAnthropicProvider } from './providers/anthropic';
import { ProviderUnavailableError, type AIMessage, type AICompletionResult, type AIProvider } from './provider';

/**
 * A provider that always reports itself unavailable rather than crashing —
 * used for any AI_PROVIDER value with no real implementation yet. Keeps a
 * misconfigured/future env value a graceful "NOT_CONFIGURED" result (same
 * path as a missing API key) instead of a hard failure at module import
 * time, which would otherwise crash every page that imports this module
 * (mission-control's Executive Summary) regardless of whether that request
 * even needed the AI provider.
 */
function unavailableProvider(name: string, message: string): AIProvider {
  return {
    name,
    async complete(): Promise<AICompletionResult> {
      throw new ProviderUnavailableError('NOT_CONFIGURED', message);
    },
  };
}

/** Provider selection (Architecture §8) — env-driven, never hardcoded to one vendor. */
function buildProvider(): AIProvider {
  switch (env.AI_PROVIDER) {
    case 'anthropic':
      return createAnthropicProvider(env.ANTHROPIC_API_KEY);
    case 'openai':
      return unavailableProvider('openai', 'OpenAI provider not implemented yet');
    default:
      return unavailableProvider('unknown', `Unknown AI_PROVIDER: ${String(env.AI_PROVIDER)}`);
  }
}

// Lazily constructed (not built eagerly at module load, same reasoning as
// the storage adapter singleton in src/server/modules/storage/index.ts) so
// an unimplemented/misconfigured provider never crashes module import —
// only the one request that actually calls .complete() sees the failure,
// and it surfaces as a typed ProviderUnavailableError, not a 500.
let cached: AIProvider | undefined;
export const aiProvider: AIProvider = {
  get name() {
    return (cached ??= buildProvider()).name;
  },
  complete(messages: AIMessage[]) {
    return (cached ??= buildProvider()).complete(messages);
  },
};

export * from './provider';
export * from './commands';
