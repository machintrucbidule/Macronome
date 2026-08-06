import type { FoodRef } from '@macronome/shared';

// A reference entry carries both languages; the client picks (spec/api/foods-recipes.md
// §Food reference catalog). One place decides, so the table, the cards and the adoption
// prefill can never show one language and create the other.

/** `'fr'` unless the UI language is English — i18next may hand back `en-GB`, `fr-FR`, … */
export function catalogLocale(language: string): 'fr' | 'en' {
  return language.startsWith('en') ? 'en' : 'fr';
}

export function refName(ref: FoodRef, language: string): string {
  return catalogLocale(language) === 'en' ? ref.name_eng : ref.name_fr;
}

export function refGroup(ref: FoodRef, language: string): string {
  return catalogLocale(language) === 'en' ? ref.group_label_eng : ref.group_label_fr;
}
