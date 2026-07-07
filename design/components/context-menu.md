# Context menu (installed desktop window)

Custom right-click menu for the installed desktop app (B-195). Replaces the browser
menu with Macronome actions; reuses the popmenu look (`MealHeader` "⋯" menu /
`SelectMenu` dropdown tokens), the `buttons.md` danger tone, and calls **existing
screen actions only** — no new API capability.

## Intent & scope

- Active **only** when the app runs in the installed window (`display-mode:
standalone`) **and** the desktop layout (>560px). Browser tabs and mobile keep the
  native browser menu untouched everywhere.
- **Text-field exception:** inside `input`, `textarea`, `select` or `contenteditable`
  the **native** menu is preserved (paste / spellcheck / text services).
- The native Edge/Chromium menu cannot be trimmed by a web app — replacement is
  all-or-nothing per zone (owner informed, run #47).

## Anatomy

- A cursor-anchored floating panel, `role="menu"`: plain action items, a **danger**
  tone for destructive items (Supprimer / Archiver), and at most **one** submenu
  level ("Déplacer vers ▸", "Aller à ▸") opening on hover/focus beside the parent
  (flips left near the viewport edge).
- Tokens: panel like the `SelectMenu` dropdown (elevated background + `--border` +
  shadow); item hover per the popmenu recipe; danger items `--danger`-family. No raw
  hex; ≥ 32px item height (mouse-first surface).

## Behaviour

- Opens at the cursor, clamped to the viewport (shifts near the right/bottom edges).
- Dismiss: **Escape**, outside mousedown, scroll, window resize, or selecting an
  item. One menu at a time; right-click on the open panel keeps it (no rebuild from
  the panel's own DOM).
- One **delegated** `contextmenu` listener resolves the clicked row from data
  attributes; the mounted screen registers its zone resolver. Anything unresolved
  falls back to the **generic** menu. A zone may prefix the generic block (separator
  in between).

## Zones (owner-approved action lists)

- **Repas food line** (desktop grid): _Modifier la quantité_ (focuses the qty cell) ·
  _Changer l'aliment_ (opens the picker; a custom line shows _Modifier_ → custom
  modal) · _Déplacer vers ▸_ (the day's **other** meals; same move capability as the
  drag, B-187) · _Épingler/Désépingler_ (referenced lines only) · _Supprimer_
  (danger). Garde-manger scaffold pre-fill lines (not yet persisted): _Changer
  l'aliment_ only. **Empty row**: _Ajouter un aliment ici_ (opens the picker on that
  row) · _Valeurs manuelles_, then the generic entries.
- **Poids period row** (closed periods): _Modifier_ (opens the ending weigh-in's
  sheet) · _Supprimer_ (danger — a dedicated styled confirm, then deletes).
  **Anywhere else on the Poids screen** (background, chart, the open-period lead
  row): _Ajouter une pesée_ (opens the add sheet), then the generic entries.
- **Journal row**: _Ouvrir le jour_ (navigates to that day's Repas). Inline edits
  (verdict, activity, comment…) stay inline — not duplicated in the menu.
- **Aliments row**: _Modifier_ (edit modal) · _Archiver_ (existing confirm) /
  _Restaurer_ — the screens' archive vocabulary, never "Supprimer".
- **Recettes row**: _Modifier_ (builder) · _Archiver_ / _Restaurer_.
- **Everywhere else (generic)**: _Aller à ▸_ Repas · Journal · Poids · Aliments ·
  Recettes · Stats (the six primary screens only) · _Actualiser les données_
  (refetches every loaded query).
