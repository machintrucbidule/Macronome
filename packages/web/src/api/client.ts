// Typed fetch wrapper: cookie session, the double-submit CSRF header, and the
// contract error envelope (spec/api/00-conventions.md). One source for every
// resource module under api/. The web app reads computed values; it never computes.
const BASE = '/api/v1';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly details?: Record<string, string>,
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

function readCsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)macronome\.csrf=([^;]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
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
  if (!res.ok) {
    const err = (data as { error?: { code?: string; details?: Record<string, string> } } | null)
      ?.error;
    throw new ApiError(res.status, err?.code ?? 'error', err?.details);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
};
