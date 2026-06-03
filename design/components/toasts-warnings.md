# Toasts & inline warnings (block-and-warn, inconsistency, dup)

Macronome favours **inline, in-context** warnings over floating toasts. Three
families.

## A. Block-and-warn (leftover flow) — masterplan v2.2 edge rules
Two conditions must **block** the action (nothing written until coherent) and
show a warning in the leftover modal:
- **leftover net > served** (you can't have more leftover than you served).
- **gross < tare** (negative net).
Visual: an inline alert inside the modal body, same anatomy as the login alert
banner but scoped to the modal: `display:flex; gap:10px; background:var(--nok-soft);
border:1px solid color-mix(in srgb, var(--nok) 45%, transparent);
border-radius:var(--r-md); padding:11px 13px; --fs-13.5; line-height:1.4`; leading
icon (17px) in `--nok`. The primary **Appliquer** button is disabled
(`disabled` styling) while blocked. Re-enables when inputs become coherent.

## B. Inconsistency notice (carb ceiling ≤ 0)
When `carb_ceiling = calorie_target − protein − fat` computes to **≤ 0**, show
the **real (negative) value** plus an inconsistency warning — **do not clamp to
0 silently** (masterplan v2.2). Render on the carb metric card / Cibles readout:
the real value in `--nok`, accompanied by an accent/nok inline note. Reuse the
**accent inline note** style from the recipe `batchnote` / food `dupwarn`:
`--font-num; --fs-11–11.5; background: color-mix(in srgb, var(--accent) 10%,
transparent); border:1px solid color-mix(... accent 40% ...);
border-radius:var(--r-sm); padding:7px 10px`. For a hard error use the `--nok`
variant instead of `--accent`.

## C. Duplicate-name warning (Aliments)
`.dupwarn` inline under the name field: hidden by default, `.show` reveals it.
Accent inline-note style (above), leading ⚠. **Non-blocking** — informational
only; save still allowed.

## D. Load/save failure banner (non-blocking)
Repas/Aliments on a load or save failure: a **non-blocking banner**; entry is
buffered locally and retried (masterplan/screens). Banner anatomy = the alert
style (A) but `--nok` border on a neutral/`--nok-soft` fill, full-width above the
content, dismissible. Does not interrupt editing.

## E. Toast (transient, optional)
For confirmations not tied to a field (e.g. "Cibles enregistrées"), a transient
toast may appear at `z-index:var(--z-toast)`. The mockups used `alert()`
placeholders; canonical = a small `--bg-elev-2` card with `--border-strong`,
`--shadow`, `--r-md`, auto-dismiss. Keep rare — inline is preferred.

## Alert banner anatomy (shared by A/B/D and login)
`display:flex; align-items:flex-start; gap:10px; border-radius:var(--r-md);
padding:11px 13px; --fs-13.5; line-height:1.4`. Error/danger:
`background:var(--nok-soft); border:1px solid color-mix(... nok 45% ...)`; icon
in `--nok`. A numeric token inside (e.g. lockout countdown) uses `--font-num;
color:var(--nok); --fw-bold`. Info/accent variant swaps `--nok`→`--accent`.

## States
hidden · shown(info) · shown(warn/error) · blocking (paired with a disabled
primary action) · dismissed.
