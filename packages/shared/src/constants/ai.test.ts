import { expect, test } from 'vitest';
import { defaultTaskPrompt, isVisionModel } from './ai.js';

test('defaultTaskPrompt returns the English advice scope', () => {
  expect(defaultTaskPrompt('advice')).toContain('personalized nutrition advice');
});

test('defaultTaskPrompt returns the meal-suggestions chef scope (B-123)', () => {
  const prompt = defaultTaskPrompt('meal_suggestions');
  expect(prompt).toContain('meal-planning assistant');
  // The chef never outputs quantities — the deterministic solver does (meal-solver.md).
  expect(prompt).toContain('Do not output any quantities');
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
