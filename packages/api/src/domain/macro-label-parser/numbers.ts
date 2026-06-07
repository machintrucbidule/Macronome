import { KCAL_PER_KJ } from '@macronome/shared';

// Number, energy and reference-weight extraction for the macro-label parser
// (spec/logic/macro-label-parser.md §2 + §4). Pure string→number helpers.

/** Lowercase + strip diacritics — for label matching and reference detection only. */
export function normalizeLabel(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// A numeric token: digits with optional thousands spaces (`1 510`) + optional comma/dot
// decimals (`9,4` / `9.4`). NBSP is replaced upstream, so a plain space suffices here.
const NUMBER = '\\d[\\d ]*(?:[.,]\\d+)?';
const NUMBER_RE = new RegExp(NUMBER);
const KCAL_RE = new RegExp(`(${NUMBER})\\s*kcal`, 'i');
const KJ_RE = new RegExp(`(${NUMBER})\\s*kj`, 'i');

/** Parse one numeric token into a number (drop thousands spaces, comma → dot). */
export function toNumber(token: string): number {
  return parseFloat(token.replace(/ /g, '').replace(',', '.'));
}

/** The first numeric value on a line, or null. Later `%`/portion columns are ignored
 * because only the first match is read (spec §3). */
export function firstNumber(line: string): number | null {
  const m = line.match(NUMBER_RE);
  return m ? toNumber(m[0]) : null;
}

export interface Energy {
  value: number;
  fromKj: boolean;
}

/** Energy → kcal (spec §2): the first kcal figure in the text; else the first kJ ÷ 4.184
 * (flagged `fromKj`); else null. The per-100 column prints first, so "first" is per-100. */
export function extractKcal(text: string): Energy | null {
  const kcal = text.match(KCAL_RE)?.[1];
  if (kcal) return { value: toNumber(kcal), fromKj: false };
  const kj = text.match(KJ_RE)?.[1];
  if (kj) return { value: toNumber(kj) * KCAL_PER_KJ, fromKj: true };
  return null;
}

export type Reference =
  | { kind: 'scale'; scale: number; scaled: boolean }
  | { kind: 'reconstituted' }
  | { kind: 'no_reference' };

const RECONSTITUTED_RE = /apres preparation|reconstitu|once prepared|as prepared|as consumed/;
const MASS_REF_RE =
  /(?:\b(?:pour|per|par|aux)\b|\/)\s*(\d[\d ]*)\s*(?:g|gr|grammes?|ml|millilitres?)\b/g;
const SERVING_REF_RE =
  /(?:\b(?:pour|per|par)\b)\s*\d*\s*(?:portions?|parts?|servings?|pieces?|biscuits?|tranches?|verres?|unites?)\b/;

/** Resolve the single scale factor applied to every read value (spec §4):
 *  per-100 → 1; an explicit other mass weight → 100/ref; reconstituted/serving-only →
 *  an error sentinel; no reference at all → 1 (assume per-100, the EU default). */
export function resolveReference(text: string): Reference {
  const norm = normalizeLabel(text);
  if (RECONSTITUTED_RE.test(norm)) return { kind: 'reconstituted' };

  const masses: number[] = [];
  for (const m of norm.matchAll(MASS_REF_RE)) {
    const g = m[1];
    if (g) masses.push(toNumber(g));
  }
  if (masses.length > 0) {
    if (masses.some((n) => n === 100)) return { kind: 'scale', scale: 1, scaled: false };
    const ref = masses[0];
    if (ref !== undefined && ref > 0) return { kind: 'scale', scale: 100 / ref, scaled: true };
  }

  if (SERVING_REF_RE.test(norm)) return { kind: 'no_reference' };
  return { kind: 'scale', scale: 1, scaled: false };
}
