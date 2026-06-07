import { classify, isLabelLine, type MacroKind } from './labels.js';
import { extractKcal, firstNumber, normalizeLabel, resolveReference } from './numbers.js';

// Macro-label parser orchestrator (spec/logic/macro-label-parser.md). Pure: free pasted
// nutrition text → the per-100 g macros found + warnings, or a structured error. No DB,
// no HTTP. The web never runs this (CLAUDE.md rule 2); it reads the result.

export type ParseErrorCode = 'reconstituted_label' | 'no_reference' | 'unparseable';
export type ParseWarning = 'kcal_from_kj' | 'scaled_from_ref' | 'macro_missing';

export interface ParsedMacros {
  kcal?: number;
  fat?: number;
  carb?: number;
  protein?: number;
}

export type ParseResult =
  | { ok: true; macros: ParsedMacros; warnings: ParseWarning[] }
  | { ok: false; code: ParseErrorCode };

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** A macro value scales by the reference factor; scaled values round to 2 decimals,
 * an as-is per-100 value is kept verbatim. */
function finalizeMacro(raw: number, scale: number, scaled: boolean): number {
  const v = raw * scale;
  return scaled ? round2(v) : v;
}

/** kcal also scales; a kJ-derived value rounds to an integer (a guess), else as a macro. */
function finalizeKcal(raw: number, scale: number, scaled: boolean, fromKj: boolean): number {
  const v = raw * scale;
  if (fromKj) return Math.round(v);
  return scaled ? round2(v) : v;
}

/** Pure vertical layout: a label row with no number takes the value from the immediately
 * following non-label line (spec §3). */
function lookAheadValue(lines: string[], i: number): number | null {
  const next = lines[i + 1];
  if (next === undefined) return null;
  if (isLabelLine(normalizeLabel(next))) return null;
  return firstNumber(next);
}

/** Read fat/carb/protein from the lines (spec §3): first number on each main-macro line,
 * first occurrence wins, "dont…/of which…" sub-lines skipped by `classify`. */
function readMacros(lines: string[], scale: number, scaled: boolean): ParsedMacros {
  const macros: ParsedMacros = {};
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const kind = classify(normalizeLabel(line));
    if (kind === 'energy' || kind === null) continue;
    const macroKind: Exclude<MacroKind, 'energy'> = kind;
    if (macros[macroKind] !== undefined) continue;
    const raw = firstNumber(line) ?? lookAheadValue(lines, i);
    if (raw !== null) macros[macroKind] = finalizeMacro(raw, scale, scaled);
  }
  return macros;
}

export function parseLabel(text: string): ParseResult {
  // Normalise exotic Unicode spaces (NBSP, narrow NBSP, thin/figure space) to a plain
  // space — keeping newlines/tabs — so thousands separators ("1 510") parse and labels match.
  const cleaned = text.replace(/[^\S\r\n\t ]/g, ' ');

  const ref = resolveReference(cleaned);
  if (ref.kind === 'reconstituted') return { ok: false, code: 'reconstituted_label' };
  if (ref.kind === 'no_reference') return { ok: false, code: 'no_reference' };
  const { scale, scaled } = ref;

  const warnings: ParseWarning[] = [];
  const macros = readMacros(cleaned.split(/\r?\n/), scale, scaled);

  const energy = extractKcal(cleaned);
  if (energy) {
    macros.kcal = finalizeKcal(energy.value, scale, scaled, energy.fromKj);
    if (energy.fromKj) warnings.push('kcal_from_kj');
  }

  const found = [macros.kcal, macros.fat, macros.carb, macros.protein].filter(
    (v) => v !== undefined,
  ).length;
  if (found === 0) return { ok: false, code: 'unparseable' };

  if (scaled) warnings.push('scaled_from_ref');
  if (found < 4) warnings.push('macro_missing');

  return { ok: true, macros, warnings };
}
