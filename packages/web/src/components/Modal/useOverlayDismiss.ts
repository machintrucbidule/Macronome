import { useEffect, useRef } from 'react';

// Dismissal for any overlay: Escape AND the hardware/gesture Back, off ONE mount-order stack
// (B-269, design/components/modals.md). Before this, Back navigated the SPA away and the overlay
// unmounted as collateral — taking whatever was being typed with it — which on Android and in the
// installed window is the primary dismissal gesture.
//
// The stack is what makes nesting correct: only the top-most overlay reacts, so a sub-dialog over
// a modal closes alone. Escape already worked this way; Back now reads the same array, so the two
// cannot drift apart.

const stack: string[] = [];
/** Overlays that currently own a history entry (see the StrictMode note on the cleanup). */
const owning = new Set<string>();
/** Consumes scheduled by a cleanup, cancellable if the same overlay re-registers immediately. */
const pendingConsume = new Map<string, ReturnType<typeof setTimeout>>();

/** Marker put on the history entry an overlay pushes, so we only ever consume our own. */
const MARK = 'macronomeOverlay';

interface OverlayHistoryState {
  [MARK]?: string;
}

const currentMark = (): string | undefined =>
  (window.history.state as OverlayHistoryState | null)?.[MARK];

/** True when `id` is the top-most open overlay. Exported for the tests. */
export function isTopOverlay(id: string): boolean {
  return stack[stack.length - 1] === id;
}

/** Current depth — used by the Repas paste guard (B-271): never act while an overlay is open. */
export function overlayDepth(): number {
  return stack.length;
}

/** Test seam: drop the stack and any pending consume between cases. */
export function resetOverlayStack(): void {
  stack.length = 0;
  owning.clear();
  for (const t of pendingConsume.values()) clearTimeout(t);
  pendingConsume.clear();
}

/**
 * Register an overlay for Escape + Back dismissal. `id` must be stable and unique per mounted
 * overlay (a `useId()` value).
 */
export function useOverlayDismiss(id: string, onClose: () => void): void {
  // Read the latest handler without re-running the effect: re-registering on every render would
  // push and consume history entries continuously.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    stack.push(id);

    // StrictMode double-invokes effects (mount → cleanup → mount). A cleanup that consumed its
    // entry synchronously called history.back(), whose popstate landed AFTER the re-mount and
    // closed the freshly opened overlay — the food modal never stayed open. So the consume is
    // deferred and cancelled here if the same overlay comes straight back.
    const pending = pendingConsume.get(id);
    if (pending !== undefined) {
      clearTimeout(pending);
      pendingConsume.delete(id);
    }
    // One history entry per overlay, pushed once: Back then pops it instead of leaving the screen.
    if (!owning.has(id)) {
      owning.add(id);
      const state: OverlayHistoryState = { [MARK]: id };
      window.history.pushState(state, '');
    }

    const onPop = (): void => {
      if (!owning.has(id) || !isTopOverlay(id)) return;
      // B-300: a nested overlay that closed by any non-Back path consumes ITS entry with a
      // history.back(), which lands the browser on OUR entry and emits this popstate. Being on our
      // own mark means the stack came back down to us — not that Back reached us — so we stay open.
      // A real Back on the top-most overlay pops our entry and lands on the one below, whose mark
      // is not our id, so that path is unaffected.
      if (currentMark() === id) return;
      owning.delete(id); // the browser already left our entry — nothing left to consume
      onCloseRef.current();
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && isTopOverlay(id)) onCloseRef.current();
    };

    window.addEventListener('popstate', onPop);
    document.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('popstate', onPop);
      document.removeEventListener('keydown', onKey);
      const i = stack.lastIndexOf(id);
      if (i >= 0) stack.splice(i, 1);
      if (!owning.has(id)) return;
      // Closed by any other path (Escape, scrim, ×, a save): consume the entry we pushed, so a
      // session of opening and closing sheets leaves no phantom entries to walk back through.
      const timer = setTimeout(() => {
        pendingConsume.delete(id);
        if (!owning.has(id)) return;
        owning.delete(id);
        if (currentMark() === id) window.history.back();
      }, 0);
      pendingConsume.set(id, timer);
    };
  }, [id]);
}
