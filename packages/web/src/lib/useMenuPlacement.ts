import { type RefObject, useLayoutEffect, useState } from 'react';

// Shared placement for the inline clickable-badge dropdowns (SelectMenu + VerdictBadge). Keeps the
// menu under its trigger AND inside the nearest clipping ancestor on both axes, so it is never cut
// off at a screen/modal edge (B-121 horizontal; B-168 the Journal day-editor sheet). Callers apply
// `left` as the menu's horizontal offset; `dropUp` is opt-in (only the activity select flips up).

// Find the nearest ancestor that clips (overflow auto/scroll/hidden) — e.g. the modal panel
// (`.modal { overflow:auto }`). The menu must stay inside its box or it gets cut off.
function clipBox(el: HTMLElement | null): {
  left: number;
  right: number;
  top: number;
  bottom: number;
} {
  for (let n = el?.parentElement ?? null; n; n = n.parentElement) {
    const o = getComputedStyle(n);
    if (/(auto|scroll|hidden)/.test(o.overflowX + o.overflowY)) {
      const r = n.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    }
  }
  return { left: 0, right: window.innerWidth, top: 0, bottom: window.innerHeight };
}

export interface MenuPlacement {
  /** Horizontal offset (px, relative to the trigger) to apply as the menu's `left`. */
  left: number | null;
  /** True when the menu should open above the trigger (no room below, more room above). */
  dropUp: boolean;
  /** Height ceiling (px) so a long list scrolls inside itself instead of being cut off by the
   *  clipping ancestor; null until measured. Opt-in — Autocomplete ignores it, its contract
   *  (forms-inputs.md §Autocomplete) says the list keeps a fixed max-height and never shrinks. */
  maxHeight: number | null;
}

/** Never taller than the autocomplete's ceiling, never so short it stops being a list. */
const MAX_MENU_H = 300;
const MIN_MENU_H = 120;

// Right-align the menu under the trigger; flip to left-align and clamp when it would spill past the
// clipping ancestor's horizontal edge (B-121). Also report `dropUp` when there is no room below and
// more room above, so a tall list near the box bottom can flip above and stay visible (B-168), and
// `maxHeight` so a list taller than BOTH sides scrolls inside itself instead of being cut off —
// flipping alone only picks the less-bad side, which is what clipped the leftover-modal container
// picker once its option list became the user's whole tare catalog.
export function useMenuPlacement(
  open: boolean,
  wrapRef: RefObject<HTMLDivElement | null>,
  menuRef: RefObject<HTMLDivElement | null>,
  count: number,
): MenuPlacement {
  const [placement, setPlacement] = useState<MenuPlacement>({
    left: null,
    dropUp: false,
    maxHeight: null,
  });
  useLayoutEffect(() => {
    if (!open) {
      setPlacement({ left: null, dropUp: false, maxHeight: null });
      return;
    }
    const place = (): void => {
      const trigger = wrapRef.current;
      const menu = menuRef.current;
      if (!trigger || !menu) return;
      const tr = trigger.getBoundingClientRect();
      const mw = menu.offsetWidth;
      const mh = menu.offsetHeight;
      const box = clipBox(trigger);
      const margin = 8;
      const gap = 4;
      let left = tr.right - mw; // right-aligned
      if (left < box.left + margin) left = tr.left; // flip to left-aligned
      left = Math.max(box.left + margin, Math.min(left, box.right - mw - margin));
      const roomBelow = box.bottom - tr.bottom;
      const roomAbove = tr.top - box.top;
      const dropUp = roomBelow < mh + gap + margin && roomAbove > roomBelow;
      // Cap to the side actually chosen, so the panel always ends inside the clipping box.
      const room = (dropUp ? roomAbove : roomBelow) - gap - margin;
      const maxHeight = Math.min(MAX_MENU_H, Math.max(MIN_MENU_H, room));
      setPlacement({ left: left - tr.left, dropUp, maxHeight });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, count, wrapRef, menuRef]);
  return placement;
}
