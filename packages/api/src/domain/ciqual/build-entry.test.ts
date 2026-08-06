import { describe, expect, it } from 'vitest';
import { buildCatalogMacros } from './build-entry.js';
import { parseTeneur } from './parse-teneur.js';

// Oracles O-1…O-9 of spec/logic/ciqual-catalog.md §7, wired verbatim: each case feeds the raw
// `teneur` strings through the real parser, so the two rules are tested as they compose.
function macros(group: string, kcal: string, fat: string, carb: string, protein: string) {
  return buildCatalogMacros(
    {
      kcal: parseTeneur(kcal),
      fat: parseTeneur(fat),
      carb: parseTeneur(carb),
      protein: parseTeneur(protein),
    },
    group,
  );
}

describe('buildCatalogMacros (ciqual-catalog.md §4, oracles §7)', () => {
  it('O-1 keeps a fully published food', () => {
    expect(macros('03', ' 250 ', ' 12,5 ', ' 30 ', ' 8,2 ')).toEqual({
      kcalPer100g: 250,
      fatPer100g: 12.5,
      carbPer100g: 30,
      proteinPer100g: 8.2,
      energyDerived: false,
    });
  });

  it('O-2 turns traces and below-LOQ macros into 0', () => {
    expect(macros('02', ' 45 ', ' traces ', ' < 0,5 ', ' 1,2 ')).toEqual({
      kcalPer100g: 45,
      fatPer100g: 0,
      carbPer100g: 0,
      proteinPer100g: 1.2,
      energyDerived: false,
    });
  });

  it('O-3 keeps a food whose macro is unmeasured while energy is published', () => {
    expect(macros('05', ' 120 ', ' 3 ', ' - ', ' 4 ')).toEqual({
      kcalPer100g: 120,
      fatPer100g: 3,
      carbPer100g: 0,
      proteinPer100g: 4,
      energyDerived: false,
    });
  });

  it('O-4 derives energy from the macros when it is unmeasured', () => {
    expect(macros('03', ' - ', ' 2 ', ' 20 ', ' 5 ')).toEqual({
      kcalPer100g: 118,
      fatPer100g: 2,
      carbPer100g: 20,
      proteinPer100g: 5,
      energyDerived: true,
    });
  });

  it('O-5 drops a beverage whose energy is unmeasured instead of deriving a false 0', () => {
    expect(macros('06', ' - ', ' 0 ', ' 5 ', ' 0 ')).toBeNull();
  });

  it('O-6 drops a food with neither energy nor a complete macro set', () => {
    expect(macros('02', ' - ', ' 1 ', ' - ', ' 2 ')).toBeNull();
  });

  it('O-7 rounds a derived energy to one decimal', () => {
    expect(macros('09', ' - ', ' 1,11 ', ' 2,22 ', ' 3,33 ')).toEqual({
      kcalPer100g: 32.2,
      fatPer100g: 1.11,
      carbPer100g: 2.22,
      proteinPer100g: 3.33,
      energyDerived: true,
    });
  });

  it('O-8 keeps a beverage whose energy IS published (only the derive is excluded)', () => {
    expect(macros('06', ' 42 ', ' 0 ', ' 10,5 ', ' - ')).toEqual({
      kcalPer100g: 42,
      fatPer100g: 0,
      carbPer100g: 10.5,
      proteinPer100g: 0,
      energyDerived: false,
    });
  });

  it('O-9 handles a zero threshold and scientific notation', () => {
    expect(macros('10', ' 0 ', ' < 0 ', ' 1E-6 ', ' 0 ')).toEqual({
      kcalPer100g: 0,
      fatPer100g: 0,
      carbPer100g: 0.000001,
      proteinPer100g: 0,
      energyDerived: false,
    });
  });
});
