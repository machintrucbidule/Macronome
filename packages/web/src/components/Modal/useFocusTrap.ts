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

export function useFocusTrap(panelRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Focus the first focusable control, falling back to the panel itself.
    const first = focusable(panel)[0];
    (first ?? panel).focus();

    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== 'Tab') return;
      const items = focusable(panel);
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (!firstItem || !lastItem) return;
      const active = document.activeElement;
      if (e.shiftKey && (active === firstItem || active === panel)) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && active === lastItem) {
        e.preventDefault();
        firstItem.focus();
      }
    };

    panel.addEventListener('keydown', onKeyDown);
    return () => {
      panel.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [panelRef]);
}
