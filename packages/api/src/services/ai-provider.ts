import { ErrorCode, type AiConnection } from '@macronome/shared';
import { ApiError } from '../http/errors.js';
import { logger } from '../observability/logger.js';
import type { ChatMessage } from '../domain/ai-dish-photo/index.js';

// Outbound proxy to the configured OpenAI-compatible provider (spec/logic/ai-connection.md §6).
// `listModels` (§6a) is the connection proof; `chatCompletion` (§6b) backs the AI uses. The
// api_key is sent as a Bearer header and is NEVER logged. Transient upstream failures (5xx +
// network) are retried briefly; the provider's own error message is surfaced to the client in
// `details.provider_message`. Status → code (§7): 401/403 → ai_unauthorized · 429 →
// ai_rate_limited · 500/502/503/504 → ai_unavailable (after retries) · network/timeout →
// ai_unreachable · 2xx-but-unparseable → ai_bad_response.

const MODELS_TIMEOUT_MS = 15_000;
const CHAT_TIMEOUT_MS = 60_000; // vision/chat completions are slow
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 800;
const RETRYABLE_STATUS = new Set([500, 502, 503, 504]);

interface ModelList {
  data: { id: string }[];
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${path}`;
}

function configured(ai: AiConnection | null): asserts ai is AiConnection {
  if (!ai || !ai.base_url || !ai.api_key || ai.api_key.trim() === '') {
    throw new ApiError(409, ErrorCode.AiNotConfigured);
  }
}

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Human message from an OpenAI/Gemini error body (`{error:{message}}` or `[{error:{message}}]`). */
function providerMessage(raw: string): string | undefined {
  try {
    const b: unknown = JSON.parse(raw);
    const obj = (Array.isArray(b) ? b[0] : b) as { error?: { message?: unknown } } | null;
    const msg = obj?.error?.message;
    return typeof msg === 'string' && msg.trim() ? msg.trim().slice(0, 300) : undefined;
  } catch {
    return undefined;
  }
}

function mapErrorStatus(status: number, msg?: string): ApiError {
  const details = msg ? { provider_message: msg } : undefined;
  if (status === 401 || status === 403) return new ApiError(502, ErrorCode.AiUnauthorized, details);
  if (status === 429) return new ApiError(429, ErrorCode.AiRateLimited, details);
  if (RETRYABLE_STATUS.has(status)) return new ApiError(503, ErrorCode.AiUnavailable, details);
  return new ApiError(502, ErrorCode.AiBadResponse, details);
}

/** Fetch a provider endpoint with brief retries on transient failures; returns the JSON body. */
async function callProvider(
  ai: AiConnection,
  path: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<unknown> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const last = attempt === MAX_ATTEMPTS;
    let res: globalThis.Response;
    try {
      res = await fetch(joinUrl(ai.base_url, path), {
        ...init,
        headers: { Authorization: `Bearer ${ai.api_key}`, ...init.headers },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      logger.warn(
        { err: { name: (err as Error)?.name }, path, attempt },
        'ai provider fetch failed',
      );
      if (last) throw new ApiError(504, ErrorCode.AiUnreachable);
      await delay(RETRY_DELAY_MS);
      continue;
    }

    if (res.ok) {
      try {
        return await res.json();
      } catch {
        throw new ApiError(502, ErrorCode.AiBadResponse);
      }
    }

    const raw = await res.text().catch(() => '');
    logger.warn({ status: res.status, path, attempt }, 'ai provider non-2xx');
    if (RETRYABLE_STATUS.has(res.status) && !last) {
      await delay(RETRY_DELAY_MS);
      continue;
    }
    throw mapErrorStatus(res.status, providerMessage(raw));
  }
  throw new ApiError(503, ErrorCode.AiUnavailable); // unreachable (loop always returns/throws)
}

/** §6a — list models; doubles as the connection proof. */
export async function listModels(ai: AiConnection | null): Promise<ModelList> {
  configured(ai);
  const body = (await callProvider(ai, 'models', {}, MODELS_TIMEOUT_MS)) as Partial<ModelList>;
  const data = body?.data;
  if (!Array.isArray(data) || !data.every((m) => m && typeof m.id === 'string')) {
    throw new ApiError(502, ErrorCode.AiBadResponse);
  }
  return { data: data.map((m) => ({ id: m.id })) };
}

/** §6b — chat completion; returns the assistant message text (choices[0].message.content). */
export async function chatCompletion(
  ai: AiConnection | null,
  model: string,
  messages: ChatMessage[],
): Promise<string> {
  configured(ai);
  const body = await callProvider(
    ai,
    'chat/completions',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, temperature: 0 }),
    },
    CHAT_TIMEOUT_MS,
  );
  const content = (body as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]
    ?.message?.content;
  if (typeof content !== 'string' || content.trim() === '') {
    throw new ApiError(502, ErrorCode.AiBadResponse);
  }
  return content;
}
