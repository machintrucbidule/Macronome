# AI dish-photo analysis (Repas custom entry)

The "Analyse par IA" affordance on the Repas **custom food/meal** modal and its image-upload
sub-dialog (B-118). Mirrors the existing **parse-label** pattern (`foods` "Parse label" button +
`ParseLabelDialog` sub-modal) but with images + an AI call, pre-filling the **custom-entry** form.
Reuses `buttons.md`, `forms-inputs.md`, `modals.md`, `toasts-warnings.md`. The custom-entry form
holds **totals**, so the AI result maps 1:1 (`spec/logic/ai-dish-photo-macros.md` §5).

## Trigger button

- In the custom-entry modal, an **"Analyse par IA"** button — placed like the foods "Parse label"
  button (in the form body, above the macro fields), or on the left of the actions bar (which today
  holds only Cancel/Save). Ghost/secondary style (`buttons.md`).
- Opens the analysis sub-dialog over the modal (same nesting as `ParseLabelDialog` over `FoodModal`).

## Analysis sub-dialog

A `modals.md` **sm/md** panel titled "Analyse par IA":

- **Image picker** — a file input (`accept="image/*"`, **multiple**) plus a drop area; selected
  images show as **thumbnails** with a remove (×) each. Cap **4** images (matches `spec/api/ai.md`);
  adding beyond the cap is blocked with a faint hint. Accepts jpeg/png/webp.
  - **Camera capture (mobile, PWA-1/B-143)** — beside "Ajouter des photos", a second
    **"Prendre une photo"** button shown **only on the phone layout** (≤560px) opens the
    device camera directly (a single-shot input with `capture="environment"`), feeding the
    **same** picker (same base64 path, same 4-image cap). The gallery button keeps its
    multi-select; on desktop only the gallery button is shown (camera button hidden).
- **Note field** — a `textarea` ("Description", `forms-inputs.md`) for what was eaten. It can be the
  **sole input** (e.g. "3 tranches de saucisson, 2 tranches de pain") — an image is not required.
- **Actions** — `Cancel` (ghost) + **"Analyser"** (primary), enabled when **at least one** of an
  image or a non-empty note is present (image alone, note alone, or both).

## States

- **idle** → **loading**: "Analyser" shows a spinner, a busy line ("L'analyse peut prendre …")
  appears in the body, and inputs (picker, note, image-remove ×) are disabled — vision calls take
  several tens of seconds.
- **error**: a `toasts-warnings.md` failure banner inside the dialog, message mapped from the API
  error code (`ai_not_configured` / `ai_unauthorized` / `ai_unreachable` / `ai_bad_response`); the
  dialog stays open so the user can retry or cancel. `ai_not_configured` hints to set up the AI
  connection in Paramètres first.
- **success**: the dialog closes and the six fields of the custom-entry form are **pre-filled**
  (name, calories, served weight, fat, carb, protein) from the result; the user reviews/edits and
  saves normally. (No toast required; the filled form is the feedback.)

## Notes

- Images are read client-side to **base64 data URLs** (`FileReader`) and sent in the JSON body
  (no multipart), consistent with the app's existing upload approach.
- Semantic tokens only (no raw hex). Tap targets ≥ 44px; thumbnails wrap on narrow widths.
- This dialog **only fills the form** — it persists nothing; saving the entry is the unchanged
  custom-entry flow.
- The model used is the configured `dish_photo_macros` one; its Paramètres picker only lists
  **image-capable** models (see `ai-connection.md`), so a generation/embedding model can't be
  picked for this task.
