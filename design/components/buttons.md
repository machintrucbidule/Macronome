# Buttons

One `.btn` base with four variants. Base font-size **13px** (CONFIRMED A2 #2).

## Base `.btn`
`--font-display; --fw-bold; --fs-13; padding:10px 16px; border-radius:var(--r-md);
border:1px solid var(--border); cursor:pointer`. (Compact contexts — headers,
weight/targets/containers/settings toolbars — may use `padding:9px 14px;
--fs-12` as a documented `sm` size; this is the same component, smaller.)

## Variants
- **primary**: `background:var(--accent); color:var(--accent-ink);
  border-color:var(--accent)`. Hover `filter:brightness(1.06)`. The main CTA
  (Enregistrer, + Pesée, + Ajouter…).
- **ghost**: `background:transparent; color:var(--text-dim)`. Hover
  `color:var(--text); border-color:var(--border-strong)`. Secondary (Annuler,
  Réinitialiser).
- **danger**: `background:transparent; color:var(--nok); border-color:
  color-mix(in srgb, var(--nok) 45%, transparent)`. Hover `background:var(--nok-soft)`
  (or `color-mix(... nok 12% ...)` for the lighter settings/account variant —
  pick `--nok-soft` as canonical fill). Archive/Delete/Sign-out.
- **secondary / neutral** (the "add-meal", toolbar `.filterbtn`,
  `.add-meal`): `--font-num; --fs-11; background:var(--bg-elev-2); border:1px solid
  var(--border-strong); color:var(--text); border-radius:var(--r-md)`. Hover
  `border-color:var(--accent); color:var(--accent)`. Use for low-emphasis inline
  actions that aren't full CTAs.

## The big "add" button (toolbar)  `.addbtn`
A primary at toolbar height: `height:var(--control-h-md)` (36px); otherwise the
primary recipe. Sits `margin-left:auto` on Aliments/Recettes toolbars.

## Submit button (login)  — large primary with spinner
Full-width, `height:var(--tap)`, primary fill, `--fs-15`. Has an inline
`.spinner` (17px ring, `--accent-ink` top-border, `spin .7s linear infinite`).

## States (all variants)
- **default / hover** (see each variant).
- **active (pressed)**: `transform: translateY(1px)` (login submit) — optional
  micro-feedback; keep subtle elsewhere.
- **focus**: visible focus ring (`box-shadow 0 0 0 3px color-mix(... focus 22% ...)`)
  for keyboard users.
- **disabled**: `cursor:not-allowed`. Filled (primary/submit): `filter:saturate(.4)
  brightness(.8)`. Ghost (e.g. AI "Configurer"): reduced affordance, `opacity`
  inherited from a `.soon` parent (.6).
- **loading** (submit): label hidden, spinner shown; inputs locked (see
  `states.md`).
