import { expect, test } from 'vitest';
import { buildDishPhotoMessages } from './assemble.js';
import { DISH_PHOTO_FORMAT_INSTRUCTION } from './format.js';
import { parseDishPhotoResult } from './parse.js';

// Neutral oracles from spec/logic/ai-dish-photo-macros.md §7.

const CLEAN =
  '{"dish_name":"Pasta","calories_kcal":620,"weight_g":350,"fat_g":18,"carb_g":80,"protein_g":24}';
const EXPECTED = {
  detected: true,
  dish_name: 'Pasta',
  kcal: 620,
  weight_g: 350,
  fat_g: 18,
  carb_g: 80,
  protein_g: 24,
};

test('§7.1 clean JSON → mapped result (calories_kcal → kcal; detected absent → true)', () => {
  const r = parseDishPhotoResult(CLEAN);
  expect(r.ok).toBe(true);
  if (r.ok) expect(r.data).toEqual(EXPECTED);
});

test('§7.2 fenced JSON → fence stripped, accepted', () => {
  const r = parseDishPhotoResult('```json\n' + CLEAN + '\n```');
  expect(r.ok).toBe(true);
  if (r.ok) expect(r.data).toEqual(EXPECTED);
});

test('§7.2b extra prose around the object → first balanced object taken', () => {
  const r = parseDishPhotoResult('Sure! Here it is: ' + CLEAN + ' Hope it helps.');
  expect(r.ok).toBe(true);
  if (r.ok) expect(r.data.dish_name).toBe('Pasta');
});

test('§7.3 quoted numbers (comma decimal) → coerced', () => {
  const r = parseDishPhotoResult(
    '{"dish_name":"X","calories_kcal":"620","weight_g":"350","fat_g":"18,5","carb_g":"80","protein_g":"24"}',
  );
  expect(r.ok).toBe(true);
  if (r.ok) expect(r.data.fat_g).toBe(18.5);
});

test('§7.4 missing field → not ok', () => {
  const r = parseDishPhotoResult(
    '{"dish_name":"X","calories_kcal":620,"weight_g":350,"fat_g":18,"carb_g":80}',
  );
  expect(r.ok).toBe(false);
});

test('§7.5 negative / NaN → not ok', () => {
  expect(
    parseDishPhotoResult(
      '{"dish_name":"X","calories_kcal":620,"weight_g":-5,"fat_g":18,"carb_g":80,"protein_g":24}',
    ).ok,
  ).toBe(false);
  expect(
    parseDishPhotoResult(
      '{"dish_name":"X","calories_kcal":620,"weight_g":350,"fat_g":"abc","carb_g":80,"protein_g":24}',
    ).ok,
  ).toBe(false);
});

test('§7.6 empty name → not ok', () => {
  const r = parseDishPhotoResult(
    '{"dish_name":"","calories_kcal":620,"weight_g":350,"fat_g":18,"carb_g":80,"protein_g":24}',
  );
  expect(r.ok).toBe(false);
});

test('§7.6b no food detected → ok, zeroed result, no validation (DS-1/B-160)', () => {
  const r = parseDishPhotoResult(
    '{"detected":false,"dish_name":"","calories_kcal":0,"weight_g":0,"fat_g":0,"carb_g":0,"protein_g":0}',
  );
  expect(r.ok).toBe(true);
  if (r.ok)
    expect(r.data).toEqual({
      detected: false,
      dish_name: '',
      kcal: 0,
      weight_g: 0,
      fat_g: 0,
      carb_g: 0,
      protein_g: 0,
    });
});

test('§7.6b detected:false short-circuits even with junk in the other fields', () => {
  const r = parseDishPhotoResult(
    '{"detected":false,"dish_name":"Aucun aliment","calories_kcal":null,"weight_g":-5,"fat_g":"abc"}',
  );
  expect(r.ok).toBe(true);
  if (r.ok) expect(r.data.detected).toBe(false);
});

test('§7.x detected:true with valid fields → mapped with detected:true', () => {
  const r = parseDishPhotoResult(
    '{"detected":true,"dish_name":"Pasta","calories_kcal":620,"weight_g":350,"fat_g":18,"carb_g":80,"protein_g":24}',
  );
  expect(r.ok).toBe(true);
  if (r.ok) expect(r.data).toEqual(EXPECTED);
});

test('§7.x not JSON at all → not ok', () => {
  expect(parseDishPhotoResult('I cannot estimate this.').ok).toBe(false);
});

test('§7.7 prompt assembly — note present: prompt + note + format + lang clause, then images', () => {
  const msgs = buildDishPhotoMessages(
    'Scope text',
    'extra note',
    ['data:image/jpeg;base64,AAA', 'data:image/png;base64,BBB'],
    'fr',
  );
  expect(msgs).toEqual([
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `Scope text\n\nextra note\n\n${DISH_PHOTO_FORMAT_INSTRUCTION}\n\nWrite the "dish_name" in French.`,
        },
        { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,AAA' } },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,BBB' } },
      ],
    },
  ]);
});

test('§7.7b prompt assembly — note empty + en locale: prompt + format + lang clause, then images', () => {
  const msgs = buildDishPhotoMessages(
    'Scope text',
    undefined,
    ['data:image/jpeg;base64,AAA'],
    'en',
  );
  expect(msgs).toEqual([
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `Scope text\n\n${DISH_PHOTO_FORMAT_INSTRUCTION}\n\nWrite the "dish_name" in English.`,
        },
        { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,AAA' } },
      ],
    },
  ]);
});
