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
- **App shortcuts (B-183)** — the manifest exposes five `shortcuts`, in this order:
  **Repas du jour** (`/`) · **Ajouter une pesée** (`/weight?action=add`) · **Journal**
  (`/history`) · **Stats** (`/stats`) · **Paramètres** (`/settings`). Shown by the OS
  on taskbar right-click (Windows) / icon long-press (Android). No per-shortcut icons
  (the OS falls back to the app icon). `/weight?action=add` opens Poids with the
  add-weigh-in sheet already open; the param is **consumed once** (stripped with a
  `replace` navigation) so refresh/back never re-opens the sheet. Logged out, the
  shortcut lands on Poids after login without the sheet (intent not preserved).
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

## Update card (Paramètres → "Mise à jour")

A `.card` after the Données card with:

- **Version** — a faint line "Version {x}" read from `GET /api/v1/health` (display-only;
  the web never decides the number — ADR-0002).
- **Forcer la mise à jour** — a ghost `buttons.md` button. New app versions install silently
  in the background and apply on the **next launch** (no prompt, no surprise reload); this
  button forces immediate activation + reload for users who want it now.
- **Installer l'app** — a ghost button shown **only when the browser offers installation**
  (Android/Chromium `beforeinstallprompt`). Hidden once installed or already running
  standalone, and on browsers that never fire the event (iOS Safari → users install via
  Share → Add to Home Screen; no in-app hint).

## States

- **update button** — idle → on click, the app reloads on the freshest shell. No loading
  state needed (activation is near-instant).
- **install button** — absent until `beforeinstallprompt` is captured; on click the native
  install sheet opens; the button disappears after `appinstalled` / when standalone.
- **version line** — shows nothing (or a dash) until `/health` resolves; never blocks the
  card.

## Haptics

Light `navigator.vibrate` feedback on two key successes — **adding a Repas entry** and
**applying an AI proposal**. Silent no-op where unsupported (iOS Safari, desktop). Not a
visual element; no control.

## Notes

- App-shell cache only — **no offline-data mode** (network required for `/api`). The service
  worker is inert in dev.
- Semantic tokens only; tap targets ≥ 44px. The card mirrors the Données card layout
  (`.card`/`.ch`/`.cb`/`.row`).
