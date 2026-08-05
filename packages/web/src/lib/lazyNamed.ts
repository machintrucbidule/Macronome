import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

/**
 * `React.lazy` over a **named** export (B-266). Every component in this app is exported by name
 * while `lazy()` wants a module whose default is the component, so each split point would
 * otherwise repeat the same `.then((m) => ({ default: m.X }))` dance.
 *
 * Used for the route table (app/routes.tsx) and for the heavy leaves that only mount when the
 * user opens them (cook mode, the custom-line / AI dialogs, the Markdown renderer).
 */
export function lazyNamed<P = Record<string, never>>(
  load: () => Promise<Record<string, unknown>>,
  name: string,
): LazyExoticComponent<ComponentType<P>> {
  return lazy(async () => ({ default: (await load())[name] as ComponentType<P> }));
}
