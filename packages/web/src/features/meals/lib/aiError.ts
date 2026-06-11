import { ApiError } from '../../../api/client';

// Shared AI error-code mapping for the dish-photo flows (the in-modal "Analyse par IA" dialog and
// the mobile one-tap meal-header entry, QP-1/B-158). An unknown/network error collapses to
// `ai_bad_response`; the provider's human message (when present) is surfaced as `detail`.
export const KNOWN_AI_ERRORS = new Set([
  'ai_not_configured',
  'ai_unauthorized',
  'ai_unreachable',
  'ai_bad_response',
  'ai_rate_limited',
  'ai_unavailable',
]);

/** Map a thrown error to a known AI error code + optional provider detail. */
export function mapAiError(err: unknown): { code: string; detail: string | null } {
  const code = err instanceof ApiError ? err.code : 'ai_bad_response';
  return {
    code: KNOWN_AI_ERRORS.has(code) ? code : 'ai_bad_response',
    detail: err instanceof ApiError ? (err.details?.provider_message ?? null) : null,
  };
}
