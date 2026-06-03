# Empty, loading & login error/lockout states

Cross-screen state patterns. Domain behaviour is owned by 2b / `screens/*.md`;
this file fixes only their **visual** treatment.

## Empty states
Calm, centred-or-inline message in `--text-dim`, with the relevant primary CTA
where one exists. No illustration.
- **Aliments** — no foods / no search match → empty-state line; the count chip
  reads `0 affichés`.
- **Recettes** — no recipes → empty list + "+ Ajouter une recette".
- **Journal** — empty year → empty list; future days with no calories render the
  kcal/macros cells as faint em-dashes (`--text-faint`), not zeros.
- **Poids** — no weigh-ins → prompt to add the first ("+ Pesée"); a **single**
  weigh-in → chart degrades gracefully (no trend/trajectory math, just the point);
  cartouche tiles show `—`.
- **Stats** — no logged days → prompt; partial year → unlogged heatmap cells in
  `--none`; months under 5 logged days don't qualify for "best month" (Gap #12).
- **Repas, empty day** — meals seeded from the day template + pantry (lines at
  qty 0); totals show 0; verdict computes from the (empty) calorie total.
- **Contenants** — built-in "Rien (0 g)" always present and locked; search with
  no match → empty body.

## Loading states (skeletons, not spinners)
Prefer skeleton placeholders that preserve layout; avoid full-screen spinners
inside the app (the spinner is reserved for the login submit).
- **Repas**: skeleton totals row + skeleton meal columns.
- **Aliments / tables**: skeleton rows (greyed bars at row height).
- Skeleton fill: a low-contrast block on `--bg-elev-2`; keep motion subtle or
  static. Show data progressively as it arrives rather than blocking the view.

## Error (non-blocking, in-app)
Load/save failure on Repas/Aliments → non-blocking banner (see
`toasts-warnings.md` D); the list renders from cache and edits buffer locally.
Never a blocking modal for transient I/O errors.

## Login — error & lockout  (pre-auth surface)
The login card carries two server-driven alert variants + a success flash.
Driven by a `data-state` on the body: `idle | loading | error | lockout | success`.
- **idle**: default; username prefilled and focused on a fresh device.
- **loading**: submit shows the inline spinner, label hidden; inputs locked.
- **error (invalid credentials)**: red alert banner `err-creds` (generic, non-
  enumerating copy: "Identifiant ou mot de passe incorrect."); **both** fields
  get `aria-invalid` (nok border + ring).
- **lockout**: alert `err-lock` with a **live countdown** (`.count`, `--font-num;
  --nok; --fw-bold`); **submit hidden**; fields + "rester connecté" disabled
  (`opacity:.4–.5; pointer-events:none`) until the timer elapses, then returns to
  idle.
- **success**: form body hidden; a `.success` flash (ok ring + check, redirect
  hint "→ JOURNAL DU JOUR") animates in (`rise`).
Copy avoids gendered/agreement forms so FR↔EN translation stays clean.
(The bottom demo state-switcher in the mockup is **not** part of the product.)

## Disabled / inert
- Disabled buttons: see `buttons.md` (filled → desaturate/dim; ghost → reduced
  affordance, `cursor:not-allowed`).
- Inert feature blocks (e.g. Settings "Assistant IA — bientôt"): wrap in `.soon`
  (`opacity:.6`) + a `bientôt` pill; controls disabled.
