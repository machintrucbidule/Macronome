import { ApiError, UNKNOWN_ERROR_CODE } from '../../api/client';

// Which message the login screen shows for a failed sign-in (design/components/states.md §Login).
//
// It reads the status AND the contract error code, not the status alone: that is what keeps a cookie/
// proxy misconfiguration or a database outage from being disguised as a wrong password — the failure
// mode that twice cost a morning of blind configuration changes (B-231).
export type LoginErrorKind = 'credentials' | 'session' | 'database' | 'application' | 'unreachable';

export interface LoginFailure {
  kind: LoginErrorKind;
  /** Diagnostic code identifying the server-side record; absent when there is nothing to quote. */
  ref?: string;
}

// A proxy that is up but cannot reach the app answers these; the app itself never does.
const GATEWAY_STATUSES = new Set([502, 503, 504]);

// Omit `ref` entirely when there is none, rather than carrying an explicit undefined: rendering then
// tests one thing — "is there a code to show?".
function failure(kind: LoginErrorKind, ref?: string): LoginFailure {
  return ref === undefined ? { kind } : { kind, ref };
}

export function classifyLoginError(err: unknown): LoginFailure {
  // No ApiError at all means fetch itself rejected: no HTTP response was ever received.
  if (!(err instanceof ApiError)) return failure('unreachable');

  // The app's own 503 is a database outage and says so; a bare gateway 503 is not.
  if (err.status === 503 && err.code === 'database_unavailable') {
    return failure('database', err.ref);
  }
  if (GATEWAY_STATUSES.has(err.status)) return failure('unreachable');
  // A body that was not the contract envelope: an HTML error page, or nothing at all.
  if (err.code === UNKNOWN_ERROR_CODE) return failure('unreachable');

  // Bad credentials is a typo, not an incident: no diagnostic code, even if the server sent one.
  if (err.status === 401) return failure('credentials');

  if (err.status === 403 && err.code === 'csrf_invalid') {
    return failure('session', err.ref);
  }
  return failure('application', err.ref);
}
