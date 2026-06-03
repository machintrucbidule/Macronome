# M9 — Polish

**Goal:** close the gap between "feature works" and "daily-use ready" — remaining
screen states, i18n completeness, accessibility, and perf on real-sized data.
Depends-on: M1–M7.

## Scope

- **States** (`design/components/states.md`): every screen has Empty / Skeleton /
  error states; login error + lockout; disabled wrappers. No raw spinners where a
  skeleton is specified.
- **i18n completeness:** FR + EN keys for every string; numbers/dates via `Intl.*`
  (not i18next); FR⇄EN text-expansion checked per `design/theming.md`. Server returns
  error **codes**; the client maps to strings.
- **Theming:** dark default + light via `data-theme`; only semantic tokens (no raw
  hex), `--tap` 40/44px responsive override.
- **Accessibility:** keyboard nav (the Repas serpentine Tab/arrow nav, cook-mode
  numpad/AZ keyboard), focus ring, modal focus trap, labelled inputs.
- **Perf:** autocomplete and Stats over years of data stay responsive (indexes from
  `spec/schema/indexes.md`); list virtualization only if measured necessary.

## Acceptance criteria

- Every screen renders its empty/loading/error states (component tests where logic is
  tricky — keyboard nav, font autosize — per `testing.md` §6, otherwise e2e smoke).
- No untranslated keys (a lint/CI check or a key-coverage test); no raw hex in `web`
  styles (lint).
- e2e a11y smoke on the critical flows; a perf check on Stats + Foods search with a
  large seed.

## Size check

Polish touches many files but adds no large ones; state components live under
`components/states/` and feature-local `states`.

## Checklist

- [ ] all screen states (empty/skeleton/error) per design/components/states.md
- [ ] i18n FR/EN complete; Intl number/date; expansion checked
- [ ] theming/tokens audit (no raw hex; --tap)
- [ ] keyboard nav + focus management + modal focus trap
- [ ] perf check on large data; indexes verified
- acceptance: state/i18n/a11y checks green; critical-flow e2e still green
