# Motion

The cross-cutting rule for what moves, what never moves, and how long it takes (B-253).

Until this chapter, `theming.md` carried the only app-wide motion rule and it was a
**restriction** ("avoid transitioning every element"). Nothing ever said what _should_
move, so each component decided alone and most decided nothing: 12 `transition`
declarations against hover rules spread over 39 stylesheets, and `@media (hover: hover)`
nowhere at all.

## A. What animates

Only **non-structural** properties, and only on these three occasions:

1. **Interactive state changes** — hover, press, focus, checked/selected, disabled.
2. **Floating surface entrance** — modals, sheets, menus, popovers, tooltips, toasts.
3. **Route content** — the page body on navigation. Never the frame around it.

Allowed properties: `color` · `background-color` · `border-color` · `opacity` ·
`filter` · `transform` · `box-shadow`.

## B. What never animates

- **Structure**: `width`, `height`, `margin`, `padding`, `gap`, `top`/`left`/`right`/`bottom`,
  `flex-basis`, `grid-template-*`. Animating layout in a shared scroll context is how a
  dense grid starts to jitter — the day-tone rule regression (B-262 follow-up) was exactly
  that: 2px of animated-adjacent layout inside an offset four other surfaces stick to.
- **Data**: a calorie total, a macro, a weight, a verdict, a date. Numbers change instantly.
  A figure that counts up is a figure you cannot read.
- **The app frame**: appbar, primary nav, bottom nav, the day-tone rule. They are the fixed
  reference the content moves against.
- **The dense Repas grid's layout.** Its rows may tint (§D) but never resize or shift.

## C. Duration ladder

| token         | value | use                                                      |
| ------------- | ----- | -------------------------------------------------------- |
| `--dur-fast`  | .15s  | hover · focus · press · any interactive state change     |
| `--dur-enter` | .18s  | floating-surface entrance · route content fade           |
| `--dur-bar`   | .2s   | progress/band fills (a value being _drawn_, not changed) |
| `--dur-theme` | .35s  | the body-level light/dark cross-fade                     |

`--ease` (`cubic-bezier(.2,.7,.2,1)`) everywhere. **No hard-coded duration in any
stylesheet** — a literal `120ms` is a token that was never named.

Nothing exceeds `--dur-theme`. Entrance motion must stay under the threshold where it reads
as latency rather than polish; the route fade in particular is deliberately at the short end.

## D. Interactive states

- **Hover rules live inside `@media (hover: hover)`** — the styles, not merely their
  transitions. This is not an optimisation: without it, hover styles fire on touch and then
  **latch**, so a tapped button keeps its hover background until something else is tapped.
  Gating the rule itself is what removes the stuck state; gating only the transition would
  leave it, silently.
- A selector list that mixes `:hover` with another state (`:focus-within`, an active-route
  class) **must be split** before gating, or the media query would take the keyboard and
  active states down with it.
- The transition for interactive state changes is declared **once, globally**, on the
  interactive **elements** (`a`, `button`, `input`, `tr`, …) — not repeated on every hover
  block. One declaration cannot drift, and restricting it to non-structural properties there
  makes §B unbreakable by default.
- **That global rule only reaches native elements**, and a CSS-module class is hashed, so it
  cannot be selected from the global sheet. A surface built from `div`/`span` therefore
  declares its own transition locally. **Repas is exactly that case** — its rows, unit chips,
  calendar cells and scroller thumb are divs, not a `<table>` — and it was missed on the first
  pass: the hover gating landed everywhere while nothing on the app's densest screen actually
  settled. When adding a hover rule, check what element carries it before assuming it is
  covered.
- **Dense tables** (Repas, Aliments, Recettes, Journal, Contenants, Utilisateurs): the row
  tint transitions `background-color` **only**. No borders growing, no rows resizing.
- Focus rings appear instantly — a focus ring that fades in is a focus ring you miss.
  Its _colour_ may transition; its presence may not.

## E. Surface entrance

- **Mobile sheets** keep the existing `sheet-up` keyframe (translate from the bottom edge).
- **Desktop modals** use the same vocabulary at a smaller amplitude: fade plus a short
  upward `translateY`, over `--dur-enter`. One motion language across both form factors.
- **Menus, popovers, tooltips**: fade only. They are attached to their trigger, so a
  displacement would read as the trigger having moved.
- **Exit is not animated.** A dismissed surface disappears: the user has already decided,
  and an exit animation delays the screen they asked for.

## F. Route content

The page body fades in on navigation (`--dur-enter`), keyed on the pathname. The appbar,
the day-tone rule and the navigation do not participate — only what is inside `<main>`.

Scroll position restoration and skeletons are unaffected: this is an opacity pass over
whatever the screen already renders, not a delay before rendering it.

## G. Reduced motion

**One layer, in `styles/global.css`, and nowhere else** (B-254). It neutralises every
animation and transition app-wide and stops the looping ones. A component **must not**
declare its own `prefers-reduced-motion` block — a guard test
(`styles/reduced-motion.test.ts`) fails the build if one appears, because that is precisely
how the earlier coverage drifted to 3 animations out of 9.

Consequence for this chapter: everything above is written **without** a reduced-motion
escape hatch. Authors add motion; the global layer removes it.
