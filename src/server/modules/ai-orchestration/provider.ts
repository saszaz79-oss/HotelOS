/**
 * AI Provider abstraction (Architecture §8). Business logic (truthfulness
 * rules, citation requirements, scoping) lives in this module, never in a
 * provider-specific prompt hardcoded elsewhere (§30).
 */
export interface AIMessage {
  role: 'system' | 'user';
  content: string;
}

export interface AICompletionResult {
  text: string;
  model: string;
  usage?: { inputTokens: number; outputTokens: number };
}

/**
 * Per-call overrides (Executive Decision Intelligence redesign) — optional,
 * defaults preserved exactly for every existing caller. Added because the
 * new Executive Intelligence narrative call requests a much longer,
 * structured response than the original 3-5 sentence Executive Summary and
 * runs inside the upload pipeline's `after()` background callback rather
 * than on a live page-render path, so the summary call's tight 8s/1024-token
 * budget (tuned for not stalling a synchronous page render) doesn't apply
 * to it.
 */
export interface AICompletionOptions {
  maxTokens?: number;
  timeoutMs?: number;
}

export interface AIProvider {
  readonly name: string;
  complete(messages: AIMessage[], options?: AICompletionOptions): Promise<AICompletionResult>;
}

export type ProviderUnavailableReason = 'NOT_CONFIGURED' | 'PROVIDER_ERROR';

export class ProviderUnavailableError extends Error {
  constructor(public reason: ProviderUnavailableReason, message: string) {
    super(message);
  }
}
