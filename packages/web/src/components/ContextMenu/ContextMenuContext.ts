import { createContext, useContext, useEffect, useRef } from 'react';
import type { CtxResolver } from './menu-types';

// Zone registration for the installed-window context menu (B-195). Screens call
// useContextMenuZone(resolver) with a plain closure over their page-level actions — the
// latest resolver is held in a ref so callers never memoize, and registration is a
// mount-scoped effect (StrictMode-safe register/cleanup). No provider (unit tests
// rendering a page alone) → no-op.

export interface ContextMenuRegistry {
  register: (resolver: CtxResolver) => () => void;
}

export const ContextMenuContext = createContext<ContextMenuRegistry | null>(null);

export function useContextMenuZone(resolver: CtxResolver): void {
  const ctx = useContext(ContextMenuContext);
  const ref = useRef(resolver);
  ref.current = resolver;

  useEffect(() => {
    if (!ctx) return;
    return ctx.register((target) => ref.current(target));
  }, [ctx]);
}
