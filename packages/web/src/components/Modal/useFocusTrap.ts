import { useEffect, type RefObject } from 'react';

// Focus management for a modal dialog (design/components/modals.md, M9b a11y): on open,
// move focus into the panel; trap Tab/Shift+Tab inside it; on close, restore focus to the
// element that was focused before the modal opened. Single responsibility — the Modal
// shell owns scrim/Escape; this owns focus only.

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusable(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
}

export function useFocusTrap(
  panelRef: RefObject<HTMLElement | null>,
  // Optional explicit initial-focus target (B-206). Search overlays pass their input so the
  // trap lands focus on it — not on the header "×" (the first focusable in DOM order), which
  // otherwise wins and leaves the mobile keyboard closed. Bypasses the offsetParent visibility
  // filter below, so it also works in jsdom (where nothing has an offsetParent).
  initialFocusRef?: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Focus the explicit initial target if given, else the first focusable control, falling back
    // to the panel itself. `preventScroll` is essential: a bare .focus() makes the browser scroll
    // the focused element into view, and for a modal that animates in (e.g. the mobile sheet's
    // slide-up) the element is mid-transform/off-screen at that instant, so the scroll chases its
    // transient position and fights the animation — the panel visibly overshoots then settles
    // (most visible on mobile). preventScroll keeps focus without the scroll, so the entrance
    // animation is clean.
    const first = initialFocusRef?.current ?? focusable(panel)[0];
    (first ?? panel).focus({ preventScroll: true });

    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== 'Tab') return;
      const items = focusable(panel);
      if (items.length === 0) {
        e.preventDefault();
        panel.focus({ preventScroll: true });
        return;
      }
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (!firstItem || !lastItem) return;
      const active = document.activeElement;
      if (e.shiftKey && (active === firstItem || active === panel)) {
        e.preventDefault();
        lastItem.focus({ preventScroll: true });
      } else if (!e.shiftKey && active === lastItem) {
        e.preventDefault();
        firstItem.focus({ preventScroll: true });
      }
    };

    panel.addEventListener('keydown', onKeyDown);
    return () => {
      panel.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [panelRef, initialFocusRef]);
}
