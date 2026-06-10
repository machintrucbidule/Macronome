import { useRef, type TouchEvent } from 'react';

// Mobile-only meal-switch swipe (spec §5.1, revision 2026-06-10): a horizontal swipe on the meal
// area sets the active meal tab (day navigation stays arrows + calendar). Desktop is untouched —
// the handlers are only attached when `enabled` (the caller gates on useIsMobile()), and touch
// events don't fire from a mouse anyway.

const THRESHOLD = 48; // px of horizontal travel before a swipe counts

/** Pure swipe decision: +1 (next meal) when swiping left far enough, -1 (previous) when swiping
 *  right, 0 when the move is too short or vertically dominant (a scroll, not a swipe). */
export function swipeIntent(dx: number, dy: number, threshold = THRESHOLD): -1 | 0 | 1 {
  if (Math.abs(dx) < threshold) return 0;
  if (Math.abs(dx) <= Math.abs(dy)) return 0; // vertical-dominant → it's a scroll
  return dx < 0 ? 1 : -1;
}

type SwipeHandlers = {
  onTouchStart?: (e: TouchEvent) => void;
  onTouchEnd?: (e: TouchEvent) => void;
};

/** Touch handlers for the meal area. Returns `{}` (no handlers) when disabled, so the desktop DOM
 *  is unchanged. Ignores multi-touch and gestures that begin on an interactive control (input,
 *  button, open menu/list) so those keep their own touch behaviour. */
export function useMealSwipe(enabled: boolean, onSwipe: (dir: -1 | 1) => void): SwipeHandlers {
  const start = useRef<{ x: number; y: number } | null>(null);
  if (!enabled) return {};
  return {
    onTouchStart: (e) => {
      const touch = e.touches.length === 1 ? e.touches[0] : null;
      const target = e.target as HTMLElement;
      if (!touch || target.closest('input, button, textarea, [role="menu"], [role="listbox"]')) {
        start.current = null;
        return;
      }
      start.current = { x: touch.clientX, y: touch.clientY };
    },
    onTouchEnd: (e) => {
      const s = start.current;
      start.current = null;
      const touch = e.changedTouches[0];
      if (!s || !touch) return;
      const dir = swipeIntent(touch.clientX - s.x, touch.clientY - s.y);
      if (dir !== 0) onSwipe(dir);
    },
  };
}
