# O2 — Reserved AI-advisor hook — **NOT part of the dev plan**

> **This is NOT a development milestone.** It does **not** carry an `M` number, it is
> **not** a build gate, and it is **not** required for v1. It is an inert seam the author
> may choose to enable later. Documented here so the information is ready if/when the
> author decides to build it.

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
