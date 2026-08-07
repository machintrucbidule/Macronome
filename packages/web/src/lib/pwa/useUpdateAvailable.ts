import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { BUILD_VERSION, IS_DEV_BUILD } from '../build-version';

// The single "is a newer build deployed?" rule (B-310). It used to be three inline lines in
// UpdateCard; À propos needs the same answer (design/components/pwa.md §Update card), and two
// copies of a comparison are two chances to disagree about whether the app is up to date.
//
// The two numbers are NOT interchangeable:
//  - `running` is baked into this bundle at build time (__APP_VERSION__) — by definition what the
//    browser is executing.
//  - `served` comes from GET /health — what the server has deployed, and the authority on that.
// They diverge in exactly the window B-286 identified: right after a deploy the server already
// reports the new number while the browser still runs the old shell.

/** The `/health` payload. Exported so every `['health']` consumer caches one shape, not two. */
export interface Health {
  status: string;
  db: string;
  version: string;
}

export interface UpdateAvailability {
  /** Version of the bundle currently executing (never undefined — it is a build-time constant). */
  running: string;
  /** Version the server reports; `undefined` until `/health` resolves. */
  served: string | undefined;
  /** True once the two are known to differ. */
  hasUpdate: boolean;
}

export function useUpdateAvailable(): UpdateAvailability {
  const health = useQuery({ queryKey: ['health'], queryFn: () => api.get<Health>('/health') });
  const served = health.data?.version;
  // An unversioned local build can never claim to be stale (dev + e2e run both sides on 'dev').
  const hasUpdate = !IS_DEV_BUILD && served !== undefined && served !== BUILD_VERSION;
  return { running: BUILD_VERSION, served, hasUpdate };
}
