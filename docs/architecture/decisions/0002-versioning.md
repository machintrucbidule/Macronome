# ADR-0002 — Versioning: the git tag is the single source of truth

Status: **Accepted**.
Date: 2026-06-08.

> This ADR is **authoritative** for how Macronome is versioned. It records a deliberate process
> the owner chose ("Plan A"). A new session reading only part of the docs must follow it. In
> particular: **the agent never creates a version tag or decides a version number — the owner
> does.**

---

## Context

Before this decision the app was effectively unversioned: every `package.json` was `0.0.0`, no git
tag existed, there was no `VERSION`/`CHANGELOG`, and the running app reported no version. Yet the
release pipeline was already wired so a git tag could drive everything: `.github/workflows/release.yml`
runs on `push: tags: ['v*']` and, via `docker/metadata-action`, publishes the image as
`:vX.Y.Z` + `:vX.Y`; `compose.yml` consumes `ghcr.io/.../macronome:${MACRONOME_TAG:-latest}`.

The goal: a real semver `x.y.z` that the **owner decides**, that **evolves**, and that is **always
in sync everywhere** — without hand-syncing the number across many files (the classic drift trap).

## Decision

1. **The annotated git tag `vX.Y.Z` is the single source of truth** for the released version
   (semantic versioning: **major** = breaking/behaviour change the user must know about, **minor**
   = new feature, **patch** = bug-fix). The owner chooses the full `x.y.z` and creates the tag.
   We start at **`v0.9.0`**.

2. **Everything else is derived — never hand-edited:**
   - the **Docker image tags** `:vX.Y.Z` + `:vX.Y` (already via `metadata-action`);
   - the **running version** is **baked into the image at build** and surfaced at
     `GET /api/v1/health` as `version`. `release.yml` resolves it (tag → the tag number; main build
     → `git describe --tags --always`, e.g. `0.9.0-5-g1a2b3c4`, or the short sha before the first
     tag) and passes it as the `APP_VERSION` build-arg; the Dockerfile runtime stage turns it into
     `ENV APP_VERSION`; `config/env.ts` reads it (default `'dev'` outside the image).

3. **`package.json` versions are NOT authoritative** and are left at `0.0.0` (the repo is private,
   nothing is published to npm). This avoids 5-file drift; the git tag is the only number that
   matters. (If ever desired, they can be bumped by a release script — but they are not the source.)

4. **Web display is deferred** — the owner will decide later how/where the SPA shows the version
   (it can read `/api/v1/health` or take a Vite build-time define). No web change in this decision.
   _Amendment (PWA-1, 2026-06-11):_ this deferral is now **lifted**. The SPA surfaces the running
   version on the Paramètres "Mise à jour" card, read from `GET /api/v1/health` (the chosen path
   above). See ADR-0003 and DECISIONS.md → "PWA-1".
   _Amendment (PWA-2 / B-286, 2026-08-06):_ **both** paths are now used, for different questions.
   `/api/v1/health` answers "which version is **deployed**" and stays the authority. The Vite
   build-time define answers "which version is the browser **running**": the same `APP_VERSION`
   build-arg is declared in the Dockerfile's **build** stage (build-args are per-stage) and
   injected as `__APP_VERSION__`, read through `packages/web/src/lib/build-version.ts`; it
   defaults to `dev` outside the image. The baked value is **display-only and
   non-authoritative** — it exists so the app can tell a stale shell from a fresh one, which is
   what makes the "Forcer la mise à jour" button meaningful (B-285). The annotated git tag
   remains the single source of truth for both.

5. **Agent rule:** an agent may _propose_ a version bump (e.g. at the end of a batch) but **must
   never create/push a tag or pick the number** — that is the owner's call, like every push.

## Release procedure

1. Land changes on `main` (normal flow). Each main push rebuilds `:latest` with `APP_VERSION` =
   the `git describe` string.
2. To cut a release, the **owner** runs: `git tag -a vX.Y.Z -m "vX.Y.Z"` then
   `git push origin vX.Y.Z`. `release.yml` publishes `:X.Y.Z` + `:X.Y`; `/api/v1/health` reports
   `X.Y.Z`. Operators pin `MACRONOME_TAG=X.Y.Z` (or track `:latest`).

## Consequences

- One decision (the tag) propagates to the image and the running `/health` with zero manual sync.
- Between releases, `:latest` is unambiguous (`X.Y.Z-N-g<sha>`), not a bare `0.0.0`.
- `compose.yml`, `ci.yml`, and the image-tag logic are unchanged. No DB/schema/contract impact.

See also: ADR-0001 (prebuilt image deployment), `docs/architecture/ops.md` (operator update flow).
