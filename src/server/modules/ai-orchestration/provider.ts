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

export interface AIProvider {
  readonly name: string;
  complete(messages: AIMessage[]): Promise<AICompletionResult>;
}

export type ProviderUnavailableReason = 'NOT_CONFIGURED' | 'PROVIDER_ERROR';

export class ProviderUnavailableError extends Error {
  constructor(public reason: ProviderUnavailableReason, message: string) {
    super(message);
  }
}
