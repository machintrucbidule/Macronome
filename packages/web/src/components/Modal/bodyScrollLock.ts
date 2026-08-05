// Background scroll lock while a modal is open (design/components/modals.md). Without it the wheel
// chains out of the panel to the page, which then slides behind the fixed scrim — the scrim itself
// does not move, so it reads as a bug.
//
// Ref-counted: a nested sub-dialog (the macro-label paste dialog over the food modal) must not
// release the lock when it closes on its own. Only the last modal restores, and it restores the
// exact previous inline values rather than blanking them.

let depth = 0;
let previousOverflow = '';
let previousPaddingRight = '';

/** A real scrollbar is never wider than this; anything above is a bogus measurement (jsdom). */
const MAX_SCROLLBAR = 40;

export function lockBodyScroll(): void {
  if (depth++ > 0) return;
  const body = document.body;
  previousOverflow = body.style.overflow;
  previousPaddingRight = body.style.paddingRight;
  // Compensate the scrollbar that is about to disappear, or the whole page jumps sideways.
  const gap = window.innerWidth - document.documentElement.clientWidth;
  if (gap > 0 && gap <= MAX_SCROLLBAR) body.style.paddingRight = `${gap}px`;
  body.style.overflow = 'hidden';
}

export function unlockBodyScroll(): void {
  if (depth === 0) return;
  if (--depth > 0) return;
  document.body.style.overflow = previousOverflow;
  document.body.style.paddingRight = previousPaddingRight;
}
