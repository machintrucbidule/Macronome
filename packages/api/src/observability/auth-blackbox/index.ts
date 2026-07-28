// Authentication black box (B-231): one durable record per failed authentication attempt on the
// app data volume. Public surface for the http layer; see security.md §7 and ops.md §6b.
export { genuineAuthRoute } from './routes.js';
export { cookieNamesFromHeader, rawCookieValue, setCookieNames } from './cookie-names.js';
export { sessionWasFound } from './session-found.js';
export { newRef } from './ref.js';
export { buildRecord, type AuthBlackBoxRecord, type AuthFailureFacts } from './record.js';
export { appendAuthFailure, authFailureFilePaths, resetAuthFailureCounter } from './store.js';
export { MAX_RECORDS } from './retention.js';
