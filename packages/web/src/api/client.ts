import { PUBLIC_PATHS } from '../app/public-paths';

// Typed fetch wrapper: cookie session, the double-submit CSRF header, and the
// contract error envelope (spec/api/00-conventions.md). One source for every
// resource module under api/. The web app reads computed values; it never computes.
const BASE = '/api/v1';

// Code used when the response carried no contract envelope at all — an HTML error page from a
// reverse proxy, an empty body, a dev-server page. Named because classifying a login failure has to
// distinguish "the server answered something we cannot read" from "the server rejected us" (B-231).
export const UNKNOWN_ERROR_CODE = 'error';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly details?: Record<string, string>,
    readonly retryAfterS?: number,
    /** Opaque diagnostic code identifying the server-side black-box record (B-231). */
    readonly ref?: string,
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

function readCsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)macronome\.csrf=([^;]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

// B-218: post-login grace window. Right after a successful login the auth cookie is still
// propagating; a background protected-page query can race navigate('/') and transiently 401.
// During this window we suppress the hard redirect below so an authenticated user is not
// ejected back to /login (RequireAuth's /auth/session probe stays the authoritative gate).
const LOGIN_GRACE_MS = 5000;
let loginGraceUntil = 0;

/** Open the post-login grace window (called by useLogin on a successful login). */
export function markLoginSuccess(now: number = Date.now()): void {
  loginGraceUntil = now + LOGIN_GRACE_MS;
}

/** Whether we are still inside the post-login grace window. Pure — unit-testable. */
export function isWithinLoginGrace(now: number = Date.now()): boolean {
  return now < loginGraceUntil;
}

// Global session-expiry handling: a 401 on a non-auth call while on a protected page means
// the session lapsed mid-use — bounce to /login (mirrors the logout flow), carrying the
// current page as ?next= so login can return there (B-219). Auth probes (/auth/*) carry their
// own 401 semantics (RequireAuth, login bad-creds) and never redirect; neither do background
// calls on a public page (RequireAuth guards route entry instead), nor 401s inside the
// post-login grace window (B-218).
function handleUnauthorized(path: string): void {
  if (path.startsWith('/auth/')) return;
  if (typeof window === 'undefined') return;
  if (PUBLIC_PATHS.has(window.location.pathname)) return;
  if (isWithinLoginGrace()) return;
  const next = window.location.pathname + window.location.search;
  window.location.assign(`/login?next=${encodeURIComponent(next)}`);
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
      error?: {
        code?: string;
        details?: Record<string, string>;
        retry_after_s?: number;
        ref?: string;
      };
    } | null
  )?.error;
  throw new ApiError(
    res.status,
    err?.code ?? UNKNOWN_ERROR_CODE,
    err?.details,
    err?.retry_after_s,
    err?.ref,
  );
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
