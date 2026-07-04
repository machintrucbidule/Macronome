import { expect, test } from 'vitest';
import { mapProduct, mapSummary } from './chronodrive-map.js';

// Neutral oracles from spec/logic/integrations-connections.md §8.3 (no personal data).

const panzani = {
  id: 'p1',
  name: 'Spaghetti',
  brand: 'Panzani',
  unitQuantityLabel: '500 g',
  image: 'http://gw.local:8080/img/p1.jpg',
  price: { default: 1.15 },
  nutrition: { base: '100 g', energyKcal: 361, fat: 1.4, carbohydrate: 72, protein: 12 },
};

test('§8.3.1 full mapping — 100 g base maps all four macros + name + comment', () => {
  expect(mapProduct(panzani)).toEqual({
    name: 'Panzani Spaghetti',
    kcal_per_100g: 361,
    fat_per_100g: 1.4,
    carb_per_100g: 72,
    protein_per_100g: 12,
    comment: '500 g',
  });
});

test('§8.3.2 non-100 g base → all four macros null (name/comment still mapped)', () => {
  const prefill = mapProduct({
    ...panzani,
    nutrition: { ...panzani.nutrition, base: 'portion (30 g)' },
  });
  expect(prefill).toEqual({
    name: 'Panzani Spaghetti',
    kcal_per_100g: null,
    fat_per_100g: null,
    carb_per_100g: null,
    protein_per_100g: null,
    comment: '500 g',
  });
});

test('§8.3.2b "100 ml" base maps too', () => {
  const prefill = mapProduct({ ...panzani, nutrition: { ...panzani.nutrition, base: '100 ml' } });
  expect(prefill.kcal_per_100g).toBe(361);
});

test('§8.3.3 absent field → that macro null, the others kept', () => {
  const { fat, ...rest } = panzani.nutrition;
  void fat;
  const prefill = mapProduct({ ...panzani, nutrition: rest });
  expect(prefill.fat_per_100g).toBeNull();
  expect(prefill.kcal_per_100g).toBe(361);
  expect(prefill.carb_per_100g).toBe(72);
  expect(prefill.protein_per_100g).toBe(12);
});

test('§8.3.4 no brand → bare name; absent unitQuantityLabel → comment null', () => {
  const prefill = mapProduct({ ...panzani, brand: null, unitQuantityLabel: undefined });
  expect(prefill.name).toBe('Spaghetti');
  expect(prefill.comment).toBeNull();
});

test('§8.3.5 kJ only → kcal null (never derived from energyKj)', () => {
  const prefill = mapProduct({
    ...panzani,
    nutrition: { base: '100 g', energyKj: 1530 },
  });
  expect(prefill.kcal_per_100g).toBeNull();
});

test('§8.3.6 spacing-tolerant base — the live "100ml" (no space) form maps', () => {
  // Real payload observed on the gateway (product 387343, semi-skimmed milk).
  const prefill = mapProduct({
    ...panzani,
    nutrition: { base: '100ml', energyKcal: 47, fat: 1.6, carbohydrate: 4.8, protein: 3.3 },
  });
  expect(prefill).toMatchObject({
    kcal_per_100g: 47,
    fat_per_100g: 1.6,
    carb_per_100g: 4.8,
    protein_per_100g: 3.3,
  });
  expect(
    mapProduct({ ...panzani, nutrition: { ...panzani.nutrition, base: '100 G' } }).kcal_per_100g,
  ).toBe(361);
});

test('no nutrition object at all → all macros null', () => {
  const prefill = mapProduct({ ...panzani, nutrition: undefined });
  expect(prefill.kcal_per_100g).toBeNull();
  expect(prefill.name).toBe('Panzani Spaghetti');
});

test('§8.1 summary shaping — snake_case, absent → null, price_eur ← price.default', () => {
  expect(mapSummary(panzani)).toEqual({
    id: 'p1',
    name: 'Spaghetti',
    brand: 'Panzani',
    image_url: 'http://gw.local:8080/img/p1.jpg',
    unit_quantity_label: '500 g',
    price_eur: 1.15,
    product_url: 'https://www.chronodrive.com/p-Pp1',
  });
  expect(mapSummary({ id: 'p2', name: 'X' })).toEqual({
    id: 'p2',
    name: 'X',
    brand: null,
    image_url: null,
    unit_quantity_label: null,
    price_eur: null,
    product_url: 'https://www.chronodrive.com/p-Pp2',
  });
});

test('§8.3.7 product_url — built from the id; missing id → null', () => {
  expect(mapSummary({ id: '387343', name: 'Lait' }).product_url).toBe(
    'https://www.chronodrive.com/p-P387343',
  );
  expect(mapSummary({ name: 'X' }).product_url).toBeNull();
});
