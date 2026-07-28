import { describe, expect, it } from 'vitest';
import { ApiError, UNKNOWN_ERROR_CODE } from '../../api/client';
import { classifyLoginError } from './classify-login-error';

const REF = 'K7QM-3ZP2';

// The login error → banner mapping (states.md §Login). 429/lockout is handled separately by the
// hook (countdown), so it is not classified here.
//
// The point of these cases (B-223, B-231): a cookie/proxy misconfiguration or a database outage must
// never read as a wrong password, and each cause must be distinguishable from the others.
describe('classifyLoginError', () => {
  it('401 invalid_credentials → credentials', () => {
    expect(classifyLoginError(new ApiError(401, 'invalid_credentials'))).toEqual({
      kind: 'credentials',
    });
  });

  // A typo is not an incident: showing a technical code for a mistyped password would be noise, so
  // the ref is dropped even when the server sent one.
  it('401 carries no diagnostic code, even when the server supplied one', () => {
    const failure = classifyLoginError(
      new ApiError(401, 'invalid_credentials', undefined, undefined, REF),
    );
    expect(failure).toEqual({ kind: 'credentials' });
    expect(failure.ref).toBeUndefined();
  });

  it('403 csrf_invalid → session, with the diagnostic code', () => {
    expect(
      classifyLoginError(new ApiError(403, 'csrf_invalid', undefined, undefined, REF)),
    ).toEqual({ kind: 'session', ref: REF });
  });

  it('503 database_unavailable → database, with the diagnostic code', () => {
    expect(
      classifyLoginError(new ApiError(503, 'database_unavailable', undefined, undefined, REF)),
    ).toEqual({ kind: 'database', ref: REF });
  });

  it('500 internal_error → application, with the diagnostic code', () => {
    expect(
      classifyLoginError(new ApiError(500, 'internal_error', undefined, undefined, REF)),
    ).toEqual({ kind: 'application', ref: REF });
  });

  it('a 403 that is not a CSRF rejection → application', () => {
    expect(classifyLoginError(new ApiError(403, 'forbidden')).kind).toBe('application');
  });

  it('a non-ApiError (fetch rejection, no HTTP response) → unreachable', () => {
    expect(classifyLoginError(new TypeError('Failed to fetch'))).toEqual({ kind: 'unreachable' });
  });

  // A proxy that is up but cannot reach the app: the app is starting, not misconfigured.
  it.each([502, 503, 504])('a bare gateway %i → unreachable', (status) => {
    expect(classifyLoginError(new ApiError(status, UNKNOWN_ERROR_CODE)).kind).toBe('unreachable');
  });

  // An HTML error page or an empty body: the client could not parse a contract envelope, so the
  // status alone cannot be trusted to mean the app answered.
  it('a response with no contract envelope → unreachable', () => {
    expect(classifyLoginError(new ApiError(500, UNKNOWN_ERROR_CODE)).kind).toBe('unreachable');
  });

  // The app's own 503 is specific and must not be swallowed by the gateway rule above it.
  it('distinguishes the app 503 from a gateway 503', () => {
    expect(classifyLoginError(new ApiError(503, 'database_unavailable')).kind).toBe('database');
    expect(classifyLoginError(new ApiError(503, UNKNOWN_ERROR_CODE)).kind).toBe('unreachable');
  });
});
