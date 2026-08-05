import { ApiError } from '../api/client';

// "Is the server reachable?" — the second of the two signals behind the offline banner (B-260).
// `navigator.onLine` alone is blind to the likely case for a self-hosted LAN/VPN instance: the
// OS still reports online while the box, the tunnel or the reverse proxy is gone. So the query
// layer reports transport failures here, and any success clears the flag.
//
// A tiny external store rather than context: QueryProvider writes to it from the QueryCache
// callbacks (outside React's tree) and AppShell reads it via useSyncExternalStore.

/** Gateway statuses that mean "nothing answered for the app", not "the app said no". */
const GATEWAY_STATUSES = new Set([502, 503, 504]);

/**
 * A failure of the transport, not of the request. `fetch` rejects with a TypeError when it
 * cannot reach the host at all; a reverse proxy with no upstream answers 502/503/504.
 * Everything else (401, 404, 409, 422, a 500 carrying the contract envelope) means the server
 * IS there and answered — those must never raise the banner.
 */
export function isTransportFailure(error: unknown): boolean {
  if (error instanceof ApiError) return GATEWAY_STATUSES.has(error.status);
  return error instanceof TypeError;
}

let unreachable = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** Record the outcome of a request. Queries retry once before reporting, so a single blip has
 *  already been given a second chance by the time `false` reaches us. */
export function reportReachable(reachable: boolean): void {
  if (unreachable === !reachable) return;
  unreachable = !reachable;
  emit();
}

export function subscribeReachability(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getServerUnreachable(): boolean {
  return unreachable;
}

/** Test seam: drop the flag and its listeners between cases. */
export function resetReachability(): void {
  unreachable = false;
  listeners.clear();
}
