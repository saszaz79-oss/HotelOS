import type { AIMessage, AICompletionResult, AIProvider } from '../provider';
import { ProviderUnavailableError } from '../provider';

const MODEL = 'claude-sonnet-5';

/**
 * Real Anthropic implementation of AIProvider (Architecture §8). API key is
 * read server-side only (env.ANTHROPIC_API_KEY, never NEXT_PUBLIC_*) — this
 * module is never imported from client code.
 */
export function createAnthropicProvider(apiKey: string | undefined): AIProvider {
  return {
    name: 'anthropic',
    async complete(messages: AIMessage[]): Promise<AICompletionResult> {
      if (!apiKey) {
        throw new ProviderUnavailableError('NOT_CONFIGURED', 'ANTHROPIC_API_KEY is not set');
      }

      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey });

      const system = messages.find((m) => m.role === 'system')?.content;
      const userMessages = messages.filter((m) => m.role === 'user');

      try {
        // Hard timeout — this call sits on Mission Control's/Executive
        // Export's synchronous render path (Architecture §30), so a slow or
        // hung API response must not be able to stall the whole page
        // indefinitely once a real API key is configured (Perf sprint
        // round 2 — not reachable today with no key set, but a latent risk
        // otherwise).
        const response = await client.messages.create(
          {
            model: MODEL,
            max_tokens: 1024,
            system,
            messages: userMessages.map((m) => ({ role: 'user' as const, content: m.content })),
          },
          { timeout: 8000 }
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
