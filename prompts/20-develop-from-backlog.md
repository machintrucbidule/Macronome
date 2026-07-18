# Macronome — backlog execution (per-session, iterative)

**What this is:** my per-session kickoff for working through `BACKLOG.md` after v1. I paste it at the **start of every backlog session**. It is self-contained: rely on this plus the repo, not on any prior conversation. It mirrors the original build discipline but is driven by `BACKLOG.md` instead of `DEV_PLAN.md`.

**Project in one line:** Macronome — a self-hosted, API-first nutrition & weight-tracking web app (React + TypeScript SPA, Node + TypeScript API, PostgreSQL, Docker).

## Load context first

Read `CLAUDE.md`, `BACKLOG.md`, `DEV_PLAN.md`, `module-map.md`, `testing.md`, and the contracts (database schema, API, domain-logic specs, design system — locations per `repo-structure.md`). The local-only `specifications/` corpus (`screens/`, `mockups/`, `masterplan.md`) is available for reference.

## Language

Converse with me in **French**. Write all code, comments, commit messages, and documentation in **English**.

## Find where we are

From `BACKLOG.md` — which holds **only outstanding work** (pending and in-progress items; completed items have been moved to `BACKLOG_ARCHIVE.md`) — identify the **next pending batch whose dependencies are met**, by priority (critical-correctness first), unless I point you to a specific batch or item. Tell me which batch you are taking.

## Per-batch workflow

The **unit of work is the batch, not the item** — a batch bundles several related items and is handled in a single cycle (one plan, one commit). Don't split a batch into per-item cycles.

1. **Plan first, then wait.** Tell me: the batch's items; whether it is a **bug-fix batch** (no contract change) or an **improvement batch** (and exactly which contracts it must amend); the files you will create/modify (via `module-map.md`); and the acceptance tests. **For each item, state in plain terms _how_ you intend to resolve it and its _user-facing effect_ — not just the item ID.** **For an improvement batch, the contract amendment is part of the plan and needs my explicit approval before any code.** Write nothing to disk until I approve.
2. **Implement** within the conventions in `CLAUDE.md` (modularity rules, the hard per-file line limit, the split rules).
3. **Approved contract changes only:** amend the contract (spec/logic, schema, api, design, or screen spec), **record it in `DECISIONS.md`** (what changed and why), and make the code and tests reflect it. **Never change a contract, spec, or architecture document without my prior approval.** If you discover mid-batch that you need one, **stop and ask.**
4. **Verify:** the batch's acceptance tests **plus the full existing test suite** plus typecheck plus lint must all be green — **no regressions.** Add tests **where they add value**: correctness and behavioural fixes get a test that fails before and passes after (improvements: a test encoding the new behaviour); **trivial cosmetic/copy items need no dedicated test** (verify visually + lint). The full suite stays green regardless.
5. **Privacy check → commit (one commit per batch, bundling its items) → archive the completed items.** Confirm `git status` shows the personal/local files untracked; commit with a **descriptive English message that lists the item IDs and a short description of what changed** — e.g. `B-006, B-009: stepper spacing on .num + Cibles macro rounding`. **Never use a placeholder, empty, or single-character message (no `@`, no `wip`, no `.`).** Then **move the completed items out of `BACKLOG.md` into `BACKLOG_ARCHIVE.md`** — append each with a one-line resolution note (what changed, where, and any `DECISIONS.md`/contract reference) — and **delete them from `BACKLOG.md`**. `BACKLOG.md` must end up holding **only outstanding work**; never let done items accumulate in it. (This clean separation is the resume mechanism: the next session simply takes the next item left in `BACKLOG.md`.) Synced tests use the **neutral oracles**; real-value and migration tests stay **local-only**. Never stage, commit, or push `specifications/`, `.env`, real-value/migration tests, or DB dumps. Push to `origin` only when I approve. `BACKLOG_ARCHIVE.md` follows the same privacy/location rule as `BACKLOG.md`.
6. **Stop and report.** Do not begin the next batch until I explicitly tell you to.

## Resolving an item — never change the UX on your own

A fix must resolve the **reported problem only**, **conform to what the relevant spec/design specifies**, and **not change any other observable behaviour or appearance**. Within those limits:

- If the conforming resolution is **single and obvious**, proceed (still stated in the plan).
- If an item can be resolved in **more than one way I would notice differently**, or the fix would **change, disable, or remove behaviour or appearance I did not ask to change**, **do not choose for me.** Present the realistic options at user level (per the question rule), with their effects, risks, and your recommendation, and **wait for my pick before coding.**
- Where a spec/design dictates the intended UI or behaviour, implement **that** — never substitute a different approach. (Example: B-006 was _digit touching the steppers_; the design specifies a proper stepper, so the fix is the spec's stepper/spacing — **not** removing the native arrows. Removing a control to "fix" a spacing report is exactly the kind of unilateral UX change that is forbidden here.)

## Contracts and architecture are otherwise FIXED

Outside an approved improvement batch (step 3), never edit a spec, contract, or architecture document. If anything looks wrong or contradictory, **stop and tell me** — never invent a rule to fill a gap.

## How to ask me questions

When you need a decision, **never ask implementation-level questions** (e.g. "should this function return null or throw?", "which type for field X?"). I decide on **behaviour and trade-offs, not internals.** Frame each question as: the **user-facing scenario**, the realistic **options as the user would experience them**, the **risks and impacts** of each (data correctness, other features affected, migration, UX), and **your recommendation** — in plain language I can judge without reading code. Resolve purely internal choices yourself, within the contracts.

## When in doubt

If you are blocked, uncertain, or tempted to exceed the current batch's scope, **ask rather than guess.** Keep changes small and reviewable; do not touch code outside the current batch without asking.

## Start

Load the context, tell me **which batch is next according to `BACKLOG.md`**, and give me that batch's plan for my approval. Write nothing to disk until I approve it.
