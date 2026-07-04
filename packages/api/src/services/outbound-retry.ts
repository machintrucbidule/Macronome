import { logger } from '../observability/logger.js';
import type { ApiError } from '../http/errors.js';

// Generic outbound fetch with timeout + brief retries on transient failures only
// (spec/logic/integrations-connections.md §7): 3 attempts, short delay, retry on
// network errors and 5xx — never on 4xx. The caller supplies the error mapping so
// each integration keeps its own code table. (Extracted from the ai-provider pattern;
// ai-provider.ts keeps its own inline copy on purpose.)

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 800;
const RETRYABLE_STATUS = new Set([500, 502, 503, 504]);

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export interface OutboundErrorMap {
  /** Network failure / timeout / DNS / refused, after retries. */
  unreachable: () => ApiError;
  /** Upstream 5xx, after retries. */
  unavailable: () => ApiError;
  /** Any other non-2xx upstream status (401/403/404/…), never retried. */
  status: (status: number, rawBody: string) => ApiError;
}

/**
 * Fetch `url` with `init`, retrying transient failures; resolves with the raw Response
 * of the first 2xx attempt. Throws the mapped ApiError otherwise. Auth headers travel
 * in `init.headers` and are never logged (`label` is a neutral tag for log lines).
 */
export async function outboundFetch(
  label: string,
  url: string,
  init: RequestInit,
  timeoutMs: number,
  map: OutboundErrorMap,
): Promise<globalThis.Response> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const last = attempt === MAX_ATTEMPTS;
    let res: globalThis.Response;
    try {
      res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    } catch (err) {
      logger.warn({ err: { name: (err as Error)?.name }, label, attempt }, 'outbound fetch failed');
      if (last) throw map.unreachable();
      await delay(RETRY_DELAY_MS);
      continue;
    }

    if (res.ok) return res;

    const raw = await res.text().catch(() => '');
    logger.warn({ status: res.status, label, attempt }, 'outbound non-2xx');
    if (RETRYABLE_STATUS.has(res.status)) {
      if (last) throw map.unavailable();
      await delay(RETRY_DELAY_MS);
      continue;
    }
    throw map.status(res.status, raw);
  }
  throw map.unavailable(); // unreachable (loop always returns/throws)
}

/** Parse a 2xx response body as JSON, or throw the caller's bad-response error. */
export async function jsonBody(
  res: globalThis.Response,
  badResponse: () => ApiError,
): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    throw badResponse();
  }
}
