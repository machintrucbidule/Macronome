import { describe, expect, test } from 'vitest';
import { parseLabel, type ParsedMacros, type ParseWarning } from './parse.js';

// Oracles from spec/logic/macro-label-parser.md §8 (EX-01…EX-13 = the author's real
// grocery-site pastes; D-1…D-7 = derived from the decisions). Each pasted example becomes
// an expected 4-tuple (absent = field left untouched) + warnings, or an expected error.

function ok(text: string): { macros: ParsedMacros; warnings: ParseWarning[] } {
  const r = parseLabel(text);
  if (!r.ok) throw new Error(`expected success, got error ${r.code}`);
  return { macros: r.macros, warnings: r.warnings };
}

describe('macro-label parser — pasted oracles (EX-01…EX-13)', () => {
  test('EX-01 vertical, no header', () => {
    const { macros } = ok(
      'Energie 225,0 kj (53,0 kcal)\nMatière Grasse 0,1\nGlucides 3,6\nProtéines 9,4\nDont sucres 1\nSel 0,09\nFibres 0',
    );
    expect(macros).toEqual({ kcal: 53, fat: 0.1, carb: 3.6, protein: 9.4 });
  });

  test('EX-02 table, "pour 100 g" (dont merged onto the main line)', () => {
    const { macros } = ok(
      'pour 100 g\nEnergie 251 kj/59 kcal\nMatières grasses dont 0,20 g\nGlucides dont 4,80 g\nProtéines 9,80 g',
    );
    expect(macros).toEqual({ kcal: 59, fat: 0.2, carb: 4.8, protein: 9.8 });
  });

  test('EX-03 table, "pour 100g (jaune + blanc)"', () => {
    const { macros } = ok(
      'pour 100g\n584 kj/140 kcal\nMatières grasses 9,80\nGlucides 0,50\nProtéines 13',
    );
    expect(macros).toEqual({ kcal: 140, fat: 9.8, carb: 0.5, protein: 13 });
  });

  test('EX-04 table, "pour 100 g" + % columns', () => {
    const { macros } = ok(
      'pour 100 g\nEnergie 240 kj/56 kcal 4 %/4 %\nMatières grasses 0 g 1 %\nGlucides 3,80 g 2 %\nProtéines 9,60 g 29 %',
    );
    expect(macros).toEqual({ kcal: 56, fat: 0, carb: 3.8, protein: 9.6 });
  });

  test('EX-05 table, "pour 100 g/100 ml", thousands space', () => {
    const { macros } = ok(
      'pour 100 g/100 ml\n1 510 kj/362 kcal 18 %/18 %\nMatières grasses 15 g\nGlucides 32 g\nProtéines 34 g\nFibres 5,90\nMagnésium 50 mg\nFer 2 mg',
    );
    expect(macros).toEqual({ kcal: 362, fat: 15, carb: 32, protein: 34 });
  });

  test('EX-06 reconstituted "état après préparation" → error', () => {
    const r = parseLabel('pour 100 millilitre etat après préparation\n154 kj/37 kcal');
    expect(r).toEqual({ ok: false, code: 'reconstituted_label' });
  });

  test('EX-07 table, "pour 100 g", thousands space', () => {
    const { macros } = ok(
      'pour 100 g\n1 700 kj/410 kcal\nMatières grasses 34 g\nGlucides 0 g\nProtéines 26 g',
    );
    expect(macros).toEqual({ kcal: 410, fat: 34, carb: 0, protein: 26 });
  });

  test('EX-08 table, "pour 100ml"', () => {
    const { macros } = ok(
      'pour 100ml\nEnergie 306 kj/72 kcal 4 %/4 %\nMatières grasses 0,50 g\nGlucides 18 g 4 %\nProtéines 0 g',
    );
    expect(macros).toEqual({ kcal: 72, fat: 0.5, carb: 18, protein: 0 });
  });

  test('EX-09 vertical, "pour 100g"', () => {
    const { macros } = ok(
      'pour 100g\n549,0 kj (130,0 kcal)\nMatières grasses 1,8\nGlucides 19\nProtéines 6,9',
    );
    expect(macros).toEqual({ kcal: 130, fat: 1.8, carb: 19, protein: 6.9 });
  });

  test('EX-10 vertical, "pour 100mL"', () => {
    const { macros } = ok(
      'pour 100mL\n169,0 kj (40,0 kcal)\nMatières grasses 1,6\nGlucides 5,1\nProtéines 0,9\nFibres 1',
    );
    expect(macros).toEqual({ kcal: 40, fat: 1.6, carb: 5.1, protein: 0.9 });
  });

  test('EX-11 vertical, no header, non-integer kcal preserved', () => {
    const { macros } = ok(
      '1430,0 kj (341,78 kcal)\nMatières grasses 14\nGlucides 27\nProtéines 32',
    );
    expect(macros).toEqual({ kcal: 341.78, fat: 14, carb: 27, protein: 32 });
  });

  test('EX-12 vertical, "pour 100g"', () => {
    const { macros } = ok(
      'pour 100g\n584,0 kj (140,0 kcal)\nMatières grasses 7,4\nGlucides 9,8\nProtéines 7,9\nFibres 1,2',
    );
    expect(macros).toEqual({ kcal: 140, fat: 7.4, carb: 9.8, protein: 7.9 });
  });

  test('EX-13 vertical, no header', () => {
    const { macros } = ok(
      '225,0 kj (53,0 kcal)\nMatières grasses 0,1\nGlucides 3,6\nProtéines 9,4\nFibres 0',
    );
    expect(macros).toEqual({ kcal: 53, fat: 0.1, carb: 3.6, protein: 9.4 });
  });
});

describe('macro-label parser — derived oracles (D-1…D-7)', () => {
  test('D-1 explicit reference weight → ×100/30 + scaled_from_ref', () => {
    const { macros, warnings } = ok(
      'pour 30 g\nEnergie (160 kcal)\nMatières grasses 6\nGlucides 18\nProtéines 3',
    );
    expect(macros).toEqual({ kcal: 533.33, fat: 20, carb: 60, protein: 10 });
    expect(warnings).toContain('scaled_from_ref');
  });

  test('D-2 partial label — protein absent → left untouched + macro_missing', () => {
    const { macros, warnings } = ok('pour 100 g\n200 kcal\nMatières grasses 10\nGlucides 20');
    expect(macros).toEqual({ kcal: 200, fat: 10, carb: 20 });
    expect(macros.protein).toBeUndefined();
    expect(warnings).toContain('macro_missing');
  });

  test('D-3 kJ only → kJ ÷ 4.184 rounded + kcal_from_kj', () => {
    const { macros, warnings } = ok(
      'pour 100 g\nEnergie 2110 kj\nMatières grasses 14\nGlucides 27\nProtéines 32',
    );
    expect(macros).toEqual({ kcal: 504, fat: 14, carb: 27, protein: 32 });
    expect(warnings).toContain('kcal_from_kj');
  });

  test('D-4 FR synonym "Lipides"', () => {
    const { macros } = ok('pour 100 g\n250 kcal\nLipides 12\nGlucides 30\nProtéines 8');
    expect(macros).toEqual({ kcal: 250, fat: 12, carb: 30, protein: 8 });
  });

  test('D-5 English EU label', () => {
    const { macros } = ok(
      'per 100g\nEnergy 2252kJ/539kcal\nFat 30.9\nof which saturates 10.6\nCarbohydrate 57.5\nof which sugars 56.3\nProtein 6.3\nSalt 0.107',
    );
    expect(macros).toEqual({ kcal: 539, fat: 30.9, carb: 57.5, protein: 6.3 });
  });

  test('D-6 "dont/of which" sub-line trap', () => {
    const { macros } = ok(
      'pour 100 g\n500 kcal\nMatières grasses 30\ndont acides gras saturés 12\nGlucides 50\ndont sucres 40\nProtéines 8',
    );
    expect(macros).toEqual({ kcal: 500, fat: 30, carb: 50, protein: 8 });
  });

  test('D-7 two-column "pour 100 g / par portion" → per-100 g column', () => {
    const { macros } = ok(
      'pour 100 g   par portion (30 g)\nEnergie 400 kcal 120 kcal\nMatières grasses 20 g 6 g\nGlucides 50 g 15 g\nProtéines 10 g 3 g',
    );
    expect(macros).toEqual({ kcal: 400, fat: 20, carb: 50, protein: 10 });
  });
});

describe('macro-label parser — guards', () => {
  test('nothing usable → unparseable', () => {
    expect(parseLabel('Bonjour, ceci n’est pas une étiquette.')).toEqual({
      ok: false,
      code: 'unparseable',
    });
  });

  test('serving-only reference with no gram weight → no_reference', () => {
    const r = parseLabel('pour 1 portion\nEnergie 250 kcal\nMatières grasses 10');
    expect(r).toEqual({ ok: false, code: 'no_reference' });
  });
});
