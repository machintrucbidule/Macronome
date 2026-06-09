# O2 — AI assistant — **NOT part of the dev plan**

> **This is NOT a development milestone.** It does **not** carry an `M` number, it is
> **not** a build gate, and it is **not** required for v1. The app ships fully without it.
>
> **Amended by B-117 (post-v1 triage) — O2 is now split:**
>
> - **O2a — Connection config & verification (specced).** The link is no longer inert: the
>   field `settings.llm_endpoint` is replaced by `settings.ai` (OpenAI-compatible base URL +
>   write-only API key + three `{model,prompt}` task slots), configured on Paramètres and
>   **verified** by listing the provider's models (`GET /settings/ai/models`). Specs:
>   `spec/logic/ai-connection.md`, `spec/api/weight-targets-stats-settings.md`,
>   `spec/schema/tables-catalog.md`, `design/components/ai-connection.md`,
>   `specifications/screens/settings.md`. See `DECISIONS.md` B-117.
> - **O2b — AI uses (reserved, below).** `POST /advisor/query` and the photo/meals/advice
>   calls remain **501 / not implemented**.
>
> The remainder of this doc describes **O2b** (the reserved uses); where it says
> `llm_endpoint`, read `settings.ai` per B-117.

**Goal:** leave the advisor **enabled, not implemented** — no behaviour in v1.
Would depend on: M0 (route plumbing), M6 (the payload shape it would receive).

## Scope (`DECISIONS.md` Gap 14)

- **Data (M7 already adds the field):** `User.settings.llm_endpoint`
  (OpenAI-compatible URL + optional key, online or local) — stored, **unused**.
- **API:** a reserved route **`POST /api/v1/advisor/query`** that returns **501
  `not_implemented`**. Documented as the seam that, once enabled, would receive a
  curated payload (recent intake, macro adherence, weight trend, deficit) assembled
  from existing read services. **No assembly, no model call, no UI in v1.**

## Acceptance criteria

- **Integration** (`testing.md` §2): `POST /advisor/query` → **501 `not_implemented`**.
- No advisor UI; no outbound network; the stored `llm_endpoint` is never read by
  runtime code (a test asserts the route is inert).

## Size check

A single thin reserved route + its test; nothing else ships.

## Checklist

- [ ] reserved route returns 501 not_implemented (integration test)
- [ ] llm_endpoint config inert (asserted unused)
- acceptance: 501 integration test green; no advisor behaviour shipped
