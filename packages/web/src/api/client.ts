import { PUBLIC_PATHS } from '../app/public-paths';

// Typed fetch wrapper: cookie session, the double-submit CSRF header, and the
// contract error envelope (spec/api/00-conventions.md). One source for every
// resource module under api/. The web app reads computed values; it never computes.
const BASE = '/api/v1';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly details?: Record<string, string>,
    readonly retryAfterS?: number,
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

function readCsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)macronome\.csrf=([^;]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

// Global session-expiry handling: a 401 on a non-auth call while on a protected page means
// the session lapsed mid-use — bounce to /login (mirrors the logout flow). Auth probes
// (/auth/*) carry their own 401 semantics (RequireAuth, login bad-creds) and never redirect;
// neither do background calls on a public page (RequireAuth guards route entry instead).
function handleUnauthorized(path: string): void {
  if (path.startsWith('/auth/')) return;
  if (typeof window === 'undefined') return;
  if (PUBLIC_PATHS.has(window.location.pathname)) return;
  window.location.assign('/login');
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET') {
    const token = readCsrfToken();
    if (token) headers['x-csrf-token'] = token;
  }

  const init: RequestInit = { method, credentials: 'include', headers };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, init);

  if (res.status === 204) return undefined as T;
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) raiseError(res, data, path);
  return data as T;
}

function raiseError(res: Response, data: unknown, path: string): never {
  if (res.status === 401) handleUnauthorized(path);
  const err = (
    data as {
      error?: { code?: string; details?: Record<string, string>; retry_after_s?: number };
    } | null
  )?.error;
  throw new ApiError(res.status, err?.code ?? 'error', err?.details, err?.retry_after_s);
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};

/** Filename from a `Content-Disposition: attachment; filename="…"` header, if present. */
function filenameFromDisposition(header: string | null): string | null {
  const match = header?.match(/filename="?([^"]+)"?/);
  return match?.[1] ?? null;
}

// Download a file response (e.g. the data export, IMP-1): fetch with the session cookie, then
// hand the blob to the browser via a transient object URL. Separate from `request` because the
// body is a binary file, not the JSON contract envelope.
export async function downloadFile(path: string, fallbackName: string): Promise<void> {
  const res = await fetch(`${BASE}${path}`, { method: 'GET', credentials: 'include' });
  if (!res.ok) {
    const data: unknown = await res.json().catch(() => null);
    raiseError(res, data, path);
  }
  const blob = await res.blob();
  const name = filenameFromDisposition(res.headers.get('Content-Disposition')) ?? fallbackName;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
