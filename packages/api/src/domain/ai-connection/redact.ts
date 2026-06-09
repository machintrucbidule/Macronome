import type { AiConnection, AiConnectionRead } from '@macronome/shared';

// Redaction (spec/logic/ai-connection.md §5). Strips the secret before the config leaves
// the API: removes `api_key`, adds `api_key_set` (true iff a non-empty key is stored), and
// passes `provider`, `base_url` and all `tasks` through unchanged. `null` in → `null` out.

export function redact(ai: AiConnection | null): AiConnectionRead | null {
  if (ai === null) return null;
  return {
    provider: ai.provider,
    base_url: ai.base_url,
    api_key_set: typeof ai.api_key === 'string' && ai.api_key.trim().length > 0,
    tasks: ai.tasks,
  };
}
