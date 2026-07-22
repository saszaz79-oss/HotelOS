import type { AIMessage, AICompletionOptions, AICompletionResult, AIProvider } from '../provider';
import { ProviderUnavailableError } from '../provider';

const MODEL = 'claude-sonnet-5';
const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Real Anthropic implementation of AIProvider (Architecture §8). API key is
 * read server-side only (env.ANTHROPIC_API_KEY, never NEXT_PUBLIC_*) — this
 * module is never imported from client code.
 */
export function createAnthropicProvider(apiKey: string | undefined): AIProvider {
  return {
    name: 'anthropic',
    async complete(messages: AIMessage[], options?: AICompletionOptions): Promise<AICompletionResult> {
      if (!apiKey) {
        throw new ProviderUnavailableError('NOT_CONFIGURED', 'ANTHROPIC_API_KEY is not set');
      }

      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey });

      const system = messages.find((m) => m.role === 'system')?.content;
      const userMessages = messages.filter((m) => m.role === 'user');

      try {
        // Default timeout/max_tokens is tuned for Mission Control's/
        // Executive Export's synchronous render path (Architecture §30) — a
        // slow or hung API response must not be able to stall the whole
        // page indefinitely. A caller running in a background pipeline
        // (e.g. the Executive Intelligence narrative call, which runs
        // inside upload/actions.ts's `after()` callback, not on a live
        // page render) can override both via `options`.
        const response = await client.messages.create(
          {
            model: MODEL,
            max_tokens: options?.maxTokens ?? DEFAULT_MAX_TOKENS,
            system,
            messages: userMessages.map((m) => ({ role: 'user' as const, content: m.content })),
          },
          { timeout: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS }
        );

        const text = response.content.map((block) => (block.type === 'text' ? block.text : '')).join('');

        return {
          text,
          model: MODEL,
          usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
        };
      } catch (err) {
        throw new ProviderUnavailableError('PROVIDER_ERROR', err instanceof Error ? err.message : String(err));
      }
    },
  };
}
