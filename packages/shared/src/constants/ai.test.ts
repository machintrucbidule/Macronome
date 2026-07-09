import { expect, test } from 'vitest';
import { defaultTaskPrompt, isVisionModel } from './ai.js';

test('defaultTaskPrompt returns the English advice scope (B-202)', () => {
  const prompt = defaultTaskPrompt('advice');
  expect(prompt).toContain('supportive nutrition coach');
  // Non-paternalistic tone is baked into the editable default (owner decision, B-202).
  expect(prompt).toContain('never paternalistic');
  // Scope carries data usage but NOT the output format/language (Markdown is hard-coded; the
  // language follows the UI locale — see spec/logic/ai-advice.md §2).
  expect(prompt).not.toContain('Markdown');
});

test('defaultTaskPrompt leans the dish-photo scope to the pessimistic side (B-129)', () => {
  const prompt = defaultTaskPrompt('dish_photo_macros');
  expect(prompt).toContain('macronutrients');
  // B-129: prefer a slight over-estimation over an under-estimation when uncertain.
  expect(prompt).toContain('pessimistic');
  expect(prompt).toContain('over-estimation');
});

test('defaultTaskPrompt returns the meal-suggestions chef scope (B-123)', () => {
  const prompt = defaultTaskPrompt('meal_suggestions');
  expect(prompt).toContain('meal-planning assistant');
  // The chef never outputs quantities — the deterministic solver does (meal-solver.md).
  expect(prompt).toContain('Do not output any quantities');
  // B-125/B-126/B-127: day-awareness + no-duplication + coherence guidance.
  expect(prompt).toContain('ALREADY ON THE DAY');
  expect(prompt).toContain('internally coherent');
});

test('isVisionModel keeps image-capable gemini models', () => {
  for (const id of [
    'gemini-2.5-flash',
    'models/gemini-2.5-pro',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
  ]) {
    expect(isVisionModel(id)).toBe(true);
  }
});

test('isVisionModel hides generation / embedding / audio families', () => {
  for (const id of [
    'models/gemini-3.1-flash-image',
    'gemini-2.0-flash-preview-image-generation',
    'imagen-3.0-generate-002',
    'text-embedding-004',
    'gemini-embedding-001',
    'veo-2.0',
    'gemini-2.5-flash-preview-tts',
    'models/aqa',
    'gemini-live-2.5-flash',
  ]) {
    expect(isVisionModel(id)).toBe(false);
  }
});
