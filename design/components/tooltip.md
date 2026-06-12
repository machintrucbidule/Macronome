# Tooltip (hover)

A small, reusable **styled HTML tooltip** for hover hints — the readable alternative to the
native `title` attribute (which is unstyled, slow to appear, and absent on touch). First used to
explain the two Journal écarts (B-164); generic so any inline element can carry one.

This is a **desktop hover affordance** — it has no touch equivalent, so callers only attach it
where a desktop pointer exists (e.g. the Journal table rows, which are replaced by cards on mobile).

## Primitives

- **Wrapper** (`.wrap`): `position: relative; display: inline-flex`. Wraps the trigger element
  (the thing being hovered) so the bubble can anchor to it without disturbing layout.
- **Bubble** (`.bubble`, `role="tooltip"`): absolutely positioned **above** the trigger
  (`bottom: calc(100% + 6px); left: 50%; transform: translateX(-50%)`), centered, with a small
  down-caret (`::after`) pointing at the trigger — the same card look as the chart tooltip.
  - Surface: `background: var(--bg-elev-2)`, `1px solid var(--border-strong)`, `box-shadow:
var(--shadow)`, `border-radius: var(--r-md)`, `z-index: var(--z-popover)`.
  - Type: prose at `--fs-11`, `color: var(--text)`, `max-width: ~220px`, wraps (`white-space:
normal`), centered.
  - `pointer-events: none` (never intercepts the cursor).
- **Reveal:** hidden by default (`opacity: 0; visibility: hidden`), shown on
  `.wrap:hover .bubble` and `.wrap:focus-within .bubble` (keyboard-focusable triggers get it too).
  No JS state — pure CSS.

## Notes

- The bubble is **always in the DOM** (CSS toggles visibility), so it is reachable by assistive
  tech via `role="tooltip"` and assertable in tests without simulating hover.
- CSS-only ⇒ no dynamic viewport-edge clamping (unlike the chart tooltip, which portals to `<body>`
  and clamps). Use it where the trigger sits away from the viewport edge; if a future use needs
  edge-flip/clamp, promote it to a portaled/fixed variant like `Chart/ChartTooltip`.
