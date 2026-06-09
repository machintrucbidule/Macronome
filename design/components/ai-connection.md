# AI assistant connection (Paramètres card)

The **Assistant IA** card on Paramètres, switched from the inert `.soon` placeholder
(`states.md`) to an **active configuration** of the remote AI link. Renders the
`settings.ai` config (`spec/api/weight-targets-stats-settings.md`,
`spec/logic/ai-connection.md`). Reuses the canonical inputs/selects of `forms-inputs.md`, the
buttons of `buttons.md`, and the toasts/banners of `toasts-warnings.md`. v1 scope =
**configure + verify the link**; no AI use is invoked.

## Card shell

A standard settings section card (`00-foundations.md` surface). Header `Assistant IA` with
**no** `bientôt` pill and **not** wrapped in `.soon`. A short intro line states the link is
optional and currently used only to configure/verify the connection (no AI feature yet).

## Connection fields

- **Base URL** — canonical text `Input` (`forms-inputs.md`). Label "URL de base". Placeholder
  hints the Gemini OpenAI-compatible base URL. Directly under the field, a small row of **ghost
  quick-fill links** — **"Utiliser l'URL Gemini"** and **"Utiliser l'URL Claude"** — each one-click
  fills the field with that provider's OpenAI-compatible endpoint (Gemini = the placeholder value;
  Claude = `https://api.anthropic.com/v1/`), so a new user need not know or copy the URL.
- **API key** — secret `Input` (`type=password`). When `api_key_set` is true the field renders
  **empty with a "•••• définie" affordance** (the stored key is **never** returned, so it is
  never shown); typing a value (re)defines it, clearing + saving removes it. Never echoed back.

## Fetch models (the link test)

- A **ghost** `Button` "Récupérer les modèles" **first persists the current form** (PATCH
  `/settings` with the typed `ai` draft, incl. the key) **then** calls `GET /settings/ai/models`,
  so the link is always tested against what is on screen — no "save first" gotcha. A `base_url`
  that fails local validation (422) marks the field invalid and aborts before the provider call.
- States: **idle** → **loading** (spinner, disabled) → **success** (a faint caption "N modèles
  disponibles") or **error** (a `toasts-warnings.md` failure banner with the message mapped from
  the error code: `ai_not_configured` / `ai_unauthorized` / `ai_unreachable` / `ai_bad_response`).
- This action **doubles as the connection proof** — there is no separate "Tester" button.

## Per-task blocks (×3)

Three labelled blocks, one per task — **`dish_photo_macros`** ("Analyse photo → macros"),
**`meal_suggestions`** ("Propositions de repas"), **`advice`** ("Conseils"). Each block has:

- **Model** — a `Select` (`forms-inputs.md`) populated from the fetched model list; **disabled
  while the list is empty** (with a hint to fetch first). Holds `tasks.<key>.model`. For the
  **`dish_photo_macros`** task the list is filtered to **image-capable** models only (generation /
  embedding / audio models are hidden — a best-effort id heuristic, since `/models` exposes no
  capability flags), so a model that can't read a photo can't be selected for it.
- **Prompt** — a multi-line `textarea` (canonical input styling, taller) holding
  `tasks.<key>.prompt`, pre-filled from the stored value (seeded from the English default). A
  **"Réinitialiser"** ghost link restores `defaultTaskPrompt(<key>)`. The textarea content is
  **English, not translated** even though its label/help are localised; a faint note states the
  **response format is handled by the app** (not editable here).

## Help / disclosure

**Two** collapsible help blocks (faint, `--text-dim`), one per supported provider, each an explicit
**step-by-step guide** for a non-technical user, in the UI language:

- **Gemini** — (1) sign in to **Google AI Studio** (`aistudio.google.com/apikey`, new tab);
  (2) create + copy the **API key** into the field; (3) fill the **base URL** via the Gemini
  quick-fill link (the exact endpoint is also shown inline); (4) fetch models and pick one per task
  (vision-capable for photo analysis). A closing note explains what a **model** is.
- **Claude** ("Comment connecter Claude") — (1) sign in to the **Anthropic console**
  (`console.anthropic.com`, new tab); (2) create + copy an **API key**; (3) fill the base URL via
  the Claude quick-fill link (`https://api.anthropic.com/v1/`); (4) fetch models and pick a Claude
  model per task. A closing note states Claude is **billed per token** (no free tier).

Rendered as ordered lists. Links open in a new tab. Use **semantic tokens** only (no raw hex).

## Save & states

- **Enregistrer** primary `Button` → `PATCH /settings` with the `ai` patch; **local validation
  only** (no provider call). Success/error via `toasts-warnings.md` toast; invalid base URL marks
  the field `aria-invalid` (`forms-inputs.md` invalid styling).
- States: **unconfigured** (empty fields, model selects disabled); **configured** (fields filled,
  key shown as "•••• définie"); **loading models**; **link error**. No `bientôt`/disabled card
  state remains.

## Responsive

Single column inside the settings column; rows wrap label/control on narrow widths; tap targets
≥ 44px, consistent with the rest of Paramètres.
