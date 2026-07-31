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

## Login — error & lockout (pre-auth surface)

The login card carries server-driven alert variants + a success flash.
Driven by a `data-state` on the body: `idle | loading | error | lockout | success`.

- **idle**: default; username prefilled and focused on a fresh device.
- **loading**: submit shows the inline spinner, label hidden; inputs locked.
- **error**: one red alert banner whose **copy is chosen by an error kind** (B-231). The kind
  is derived from the response status **and** the contract error code — never from the status
  alone, so a cookie/proxy misconfiguration can never read as a wrong password. Only the
  credentials kind marks the fields `aria-invalid`; the others are not the user's input's
  fault. The five kinds:
  - **credentials** — API **401 `invalid_credentials`**. Generic, non-enumerating copy
    ("Identifiant ou mot de passe incorrect."); **both** fields get `aria-invalid` (nok
    border + ring). **No diagnostic code** (a typo is not an incident).
  - **session** — **403 `csrf_invalid`**: the session could not be established because the
    server did not accept the cookie. Copy is **actionable and names the settings to check**
    (`COOKIE_SECURE`, `TRUSTED_PROXY`) — this is the `COOKIE_SECURE`/trust-proxy trap, and
    naming it is the point. Carries the diagnostic code.
  - **database** — **503 `database_unavailable`**: the database is temporarily unreachable.
    Copy says to wait and retry, and implies **no** configuration change. Carries the code.
  - **application** — any other 4xx/5xx that returned a contract envelope. Copy names an
    internal server error and points at the code. Carries the code.
  - **unreachable** — no usable response at all: a `fetch` failure, a proxy **502/503/504**,
    or a body that is not the contract envelope (an HTML error page). Copy covers "unreachable
    **or still starting**". **No diagnostic code** — none could have been written.
- **error — diagnostic code** (the `session` / `database` / `application` kinds): below the
  message, a small labelled row with the code (`XXXX-XXXX`) in `--font-num` inside a dashed
  field-toned chip, `user-select:all`, plus a ghost "Copier" button that confirms with
  "Copié". The chip is the primary affordance and the button is **progressive enhancement**:
  a plain-HTTP self-hosted instance is not a secure context, so `navigator.clipboard` may not
  exist — selecting the code by hand must always work. The button is `type="button"` (it lives
  inside the login `<form>`). The code identifies the server-side black-box record
  (`ops.md` §6b) so the operator can quote it instead of hunting logs.
- **lockout**: alert `err-lock` with a **live countdown** (`.count`, `--font-num;
--nok; --fw-bold`); **submit hidden**; fields + "rester connecté" disabled
  (`opacity:.4–.5; pointer-events:none`) until the timer elapses, then returns to
  idle.
- **success**: form body hidden; a `.success` flash (ok ring + check, redirect
  hint "→ JOURNAL DU JOUR") animates in (`rise`).
  Copy avoids gendered/agreement forms so FR↔EN translation stays clean.
  (The bottom demo state-switcher in the mockup is **not** part of the product.)

## Page introuvable (unknown route) — B-241

A URL matching no route renders a **not-found screen inside the normal app frame** (appbar +
nav), never a blank page: a centred column with the screen title, one calm explanatory line in
`--text-dim` (the empty-state treatment above — same `.empty` line, no illustration), and a
single accent **link back to the home screen**. No CTA button, no error tone: a wrong address is
not a failure of the app.

It sits **behind the same auth guard as every other route**, so a logged-out visitor of an
unknown URL is sent to the login screen exactly like a logged-out visitor of a real one (owner
decision) — the app frame is never shown without a session. Retired paths are declared as
explicit redirects instead of falling through here (B-240), so a stale bookmark or an installed
PWA shortcut lands on the renamed screen, not on this page.

## Disabled / inert

- Disabled buttons: see `buttons.md` (filled → desaturate/dim; ghost → reduced
  affordance, `cursor:not-allowed`).
- Inert feature blocks (e.g. Settings "Assistant IA — bientôt"): wrap in `.soon`
  (`opacity:.6`) + a `bientôt` pill; controls disabled.
