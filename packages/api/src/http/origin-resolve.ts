import type { Request } from 'express';

// Pure public-origin resolution (B-217), kept env-free so it is unit-testable without loading
// config/env.ts. `deriveOrigin`/`isHttpsOrigin` in origin.ts wrap this with `env.PUBLIC_ORIGIN`.

/** Effective public origin: `publicOrigin` when set, else `{scheme}://{host}` from `req`. */
export function resolveOrigin(
  publicOrigin: string | undefined,
  req: Pick<Request, 'protocol'> & { get(name: string): string | undefined },
): string {
  const base = publicOrigin ?? `${req.protocol}://${req.get('host') ?? ''}`;
  return base.replace(/\/+$/, '');
}
