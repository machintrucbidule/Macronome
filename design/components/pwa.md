# PWA install, update & app chrome

The installable-app surface (PWA-1, ADR-0003). Covers the manifest-driven app chrome
(icon, standalone window, status-bar colour) and the two Paramètres controls — **force
update** and **install** — plus the version line. Reuses `buttons.md` (ghost button),
`metric-cards.md`/Paramètres `.card` anatomy, and the semantic colour tokens
(`00-foundations.md`). No raw hex in app styles.

## App chrome (manifest + meta)

- **Icon** — the brand "tick" (metronome ring + needle, amber `--accent` baked) on a
  filled dark disc. The mark is **full-bleed** on the standard (transparent-exterior)
  icons — the disc spans ~94% of the canvas (a ~3% breathing margin) so the installed
  taskbar/home icon renders at the same visual size as neighbouring apps (B-196). The
  padded **maskable** variant (mark on the dark disc) keeps Android's adaptive-crop
  safe zone, and iOS keeps its dark **apple-touch** icon — both via generation padding
  compensated so their rendered mark size is unchanged. The existing browser-tab
  `favicon` and the `00-foundations.md` brand mark are unchanged.
- **Window & title bar** — `display: standalone` (no URL bar), `start_url: '/'`. In the
  **installed window** the manifest also sets `display_override: ['window-controls-overlay',
'standalone']` (B-200): where the browser supports it (desktop Edge/Chromium) the OS drops its
  own title bar and leaves only the **native window buttons** (minimise / maximise / close) at
  their usual corner (top-right on Windows, top-left on macOS), overlaid on the app. The app
  **header** (brand tick + wordmark + primary nav + theme toggle + account menu) is lifted into
  that freed title-bar strip; the strip is the window **drag** region (`app-region: drag`) and the
  interactive controls opt out (`app-region: no-drag`). The header is confined to the OS-provided
  free rectangle (`env(titlebar-area-*)`) so the right-hand controls never sit under the native
  buttons, on any OS. **We do not draw our own window buttons** — the browser keeps its native set.
  Browsers without WCO support, and mobile, fall back to plain `display: standalone` (unchanged),
  and a browser tab is unaffected. Installed-window feature gates (`useIsStandalone`, the `lib/pwa`
  install button) treat a WCO window as installed too. In WCO the header keeps the normal appbar
  height (B-204), and the runtime `theme-color` is set to **`--bg-elev`** so the strip the browser
  paints behind the native window buttons matches the header — the title band is one uniform colour
  across the full width, no seam (B-205; semantic tokens only, WCO-mode only).
- **App shortcuts (B-183, icons B-259)** — the manifest exposes five `shortcuts`, in this order:
  **Repas du jour** (`/`) · **Ajouter une pesée** (`/weight?action=add`) · **Journal**
  (`/history`) · **Stats** (`/stats`) · **Paramètres** (`/settings`). Shown by the OS
  on taskbar right-click (Windows) / icon long-press (Android). **Each carries its own 96px
  icon**: without them the OS drew the app icon five times over and the jump list was
  unreadable. The glyphs are the **mobile bottom nav's own** — same mark in the jump list and in
  the phone tab bar — except **Paramètres**, which has no counterpart there (the bar carries only
  the six primary routes) and is the single glyph drawn for this set. Sources in
  `packages/web/icons/`, rasterised by `gen:pwa-assets` and committed; a guard test fails the
  build if a shortcut glyph and its bottom-nav original ever drift apart.
  `/weight?action=add` opens Poids with the add-weigh-in sheet already open; the param is
  **consumed once** (stripped with a `replace` navigation) so refresh/back never re-opens the
  sheet. Logged out, the shortcut lands on Poids after login without the sheet (intent not
  preserved).
- **App-icon badge (B-262)** — while the app runs, `navigator.setAppBadge()` marks the installed
  icon whenever the **current day is not compliant** (tone ≠ `ok`, including `none` — a day with
  nothing logged is exactly when the reminder earns its keep), and `clearAppBadge()` removes it
  once the day is `ok`. **The badge cannot carry the verdict colour**: the API accepts only a
  number or a bare dot and the OS paints it in the system accent, and an installed app's icon is
  frozen at install time. The tone therefore lives in the title-strip rule (`top-nav.md`); the
  badge is a colourless "look at me". Progressive enhancement — guarded on API presence
  (Chromium desktop; a silent no-op elsewhere, like the haptics below). **Known limitation:** it
  only updates while the app is running, so an app closed all day shows the last session's state.
- **Single window (B-183)** — `launch_handler: { client_mode: 'focus-existing' }`:
  launching the installed app focuses the existing window instead of opening a second
  one.
- **Status-bar colour** — a `theme-color` meta tracks a live token, so the OS app-bar follows the
  in-app light/dark theme (updated whenever the theme changes). It reads **`--bg`** in a browser tab
  and on the mobile status bar, and **`--bg-elev`** in the installed WCO window (so the native-button
  strip matches the header — B-205).

- **Install-dialog presentation (B-259)** — the manifest carries `description`, `categories`
  (`health`, `fitness`, `lifestyle`) and three **`screenshots`** (two `wide`, one `narrow`), so
  Edge's install card shows what the app looks like instead of a bare name + icon. The
  screenshots are downscaled WebP re-encodes of the README previews — nothing new is exposed —
  and are **excluded from the service-worker precache** (`globIgnores`): they are seen once, at
  install time. `index.html` carries the matching `<meta name="description">`.
- **`id` (B-259)** — the manifest declares `id: '/'`. Without it the browser keys the install on
  `start_url`, so any future change there would register as a **different app**: a second icon,
  and the existing install orphaned. Set while `start_url` is still `/`, it costs nothing and
  removes that trap permanently.
- **Manifest changes need a refreshed install.** An installed PWA keeps its frozen manifest — the
  shipped `dist/manifest.webmanifest` still listed the pre-B-240 `/parametres` shortcut long after
  the route was renamed. Everything above therefore takes effect only once the install refreshes.
- **Pull-to-refresh is deliberately KEPT (B-258, owner decision).** There is no document-level
  `overscroll-behavior`, so Android's native pull-to-refresh still works — and can still reload
  the SPA if a list is dragged down past its top. That cost was weighed and accepted against
  losing the gesture. Scroll containers that must not chain keep their own `overscroll-behavior:
contain`; that is a different rule and stays.

## Update card (Paramètres → "Mise à jour")

A `.card` after the Données card with:

- **Version** — a faint line "Version {running}", the version of the **bundle currently
  executing**, baked into it at build (B-286). When the server reports a different one, the line
  becomes **"Version {running} → {served}"**. The served number comes from `GET /api/v1/health`
  and stays the authority for "what is deployed"; the baked one is **non-authoritative and
  diagnostic** — the git tag remains the source of truth (ADR-0002). Before B-286 the line showed
  the **served** number alone, so right after a deploy it claimed to be up to date while the
  browser still ran the old shell — which is what hid the dead button below.
- **Forcer la mise à jour** — a ghost `buttons.md` button. New app versions install silently
  in the background and apply on the **next launch** (no prompt, no surprise reload); this
  button forces immediate activation + reload for users who want it now. On click it **asks the
  server for a new build**, activates it if there is one, and **always reloads — even when
  nothing new is found** (B-285, owner decision): the control is labelled "forcer" and must be
  deterministic, and a "déjà à jour" no-op branch would re-expose the original symptom (a button
  that does nothing) whenever detection fails. While the two versions differ, a discreet accent
  mention **"Nouvelle version disponible"** sits next to the button — accent text only, not a
  pill and not a restyled button: Paramètres is not an alert surface.
- **Installer l'app** — a ghost button shown **only when the browser offers installation**
  (Android/Chromium `beforeinstallprompt`). Hidden once installed or already running
  standalone, and on browsers that never fire the event (iOS Safari → users install via
  Share → Add to Home Screen; no in-app hint).

**The same availability rule also surfaces on À propos — [B-310].** The running-vs-served
comparison lives in **one** hook (`lib/pwa/useUpdateAvailable`) that this card and the À propos
Application card both consume; neither recomputes it. À propos shows the two numbers as two rows
(_Version installée_ / _Version du serveur_) and, when they differ, the same accent mention plus a
**link back to this card** — never a second update button. The action stays here.

## States

- **update button** — idle → on click, **disabled and labelled "Mise à jour…"** while the
  network check runs (it is a round-trip, not an instant activation) → the app reloads on the
  freshest shell → a toast confirms on the other side of the reload: **"Mise à jour appliquée"**
  when a waiting version was activated, **"Déjà à jour"** otherwise. The confirmation is handed
  across the reload (`toastAfterReload`), like the data import.
- **install button** — absent until `beforeinstallprompt` is captured; on click the native
  install sheet opens; the button disappears after `appinstalled` / when standalone.
- **version line** — "Version {running}" from the first paint (the running version is baked
  into the bundle, nothing to wait for); becomes "Version {running} → {served}" once `/health`
  resolves on a different number. Never blocks the card. An unversioned build (`dev`: local
  Vite, e2e) never shows the arrow form and never claims to be stale.

## Haptics

Light `navigator.vibrate` feedback on two key successes — **adding a Repas entry** and
**applying an AI proposal**. Silent no-op where unsupported (iOS Safari, desktop). Not a
visual element; no control.

## Notes

- App-shell cache only — **no offline-data mode** (network required for `/api`). The service
  worker is inert in dev.
- Semantic tokens only; tap targets ≥ 44px. The card mirrors the Données card layout
  (`.card`/`.ch`/`.cb`/`.row`).
