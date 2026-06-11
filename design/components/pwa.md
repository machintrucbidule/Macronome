# PWA install, update & app chrome

The installable-app surface (PWA-1, ADR-0003). Covers the manifest-driven app chrome
(icon, standalone window, status-bar colour) and the two Paramètres controls — **force
update** and **install** — plus the version line. Reuses `buttons.md` (ghost button),
`metric-cards.md`/Paramètres `.card` anatomy, and the semantic colour tokens
(`00-foundations.md`). No raw hex in app styles.

## App chrome (manifest + meta)

- **Icon** — the brand "tick" (metronome ring + needle, amber `--accent` baked) on a
  filled dark disc. The home-screen icon is opaque; the transparent-exterior variant is the
  standard icon, and a padded **maskable** variant (mark on the dark disc) covers Android's
  adaptive crop. iOS uses a dark **apple-touch** icon. The existing browser-tab `favicon`
  and the `00-foundations.md` brand mark are unchanged.
- **Standalone** — `display: standalone` (no URL bar). `start_url: '/'`.
- **Status-bar colour** — a `theme-color` meta tracks the live `--bg` token, so the OS
  app-bar follows the in-app light/dark theme (updated whenever the theme changes).

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
