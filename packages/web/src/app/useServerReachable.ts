import { useEffect, useState, useSyncExternalStore } from 'react';
import { getServerUnreachable, subscribeReachability } from './reachability';

// The offline banner's condition (B-260, design/components/states.md §Server unreachable).
// Two signals, because either alone is blind:
//   1. `navigator.onLine` — no network at all; instant, and true even before a request is tried.
//   2. transport failures reported by the query layer — the server is unreachable while the OS
//      still reports online, which is the likely case on a LAN/VPN self-hosted instance.

/** Whether the app currently believes the server cannot be reached. */
export function useServerReachable(): boolean {
  const unreachable = useSyncExternalStore(
    subscribeReachability,
    getServerUnreachable,
    () => false, // SSR/prerender: never claim an outage we have not observed
  );
  const [offline, setOffline] = useState(
    () => typeof navigator !== 'undefined' && !navigator.onLine,
  );

  useEffect(() => {
    const sync = (): void => setOffline(!navigator.onLine);
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    sync(); // the state may have changed between first render and mount
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  return !(offline || unreachable);
}
