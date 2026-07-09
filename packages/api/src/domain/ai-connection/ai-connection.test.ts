import { expect, test } from 'vitest';
import { AiConnectionSchema, defaultTaskPrompt, type AiConnection } from '@macronome/shared';
import { redact } from './redact.js';
import { mergeAi } from './merge.js';

// Neutral oracles from spec/logic/ai-connection.md §8 (no personal data).

const tasks: AiConnection['tasks'] = {
  dish_photo_macros: { model: null, prompt: defaultTaskPrompt('dish_photo_macros') },
  meal_suggestions: { model: null, prompt: defaultTaskPrompt('meal_suggestions') },
  advice: { model: null, prompt: defaultTaskPrompt('advice') },
};

test('§8.1 valid config', () => {
  const res = AiConnectionSchema.safeParse({
    provider: 'openai_compatible',
    base_url: 'https://x/v1',
    api_key: 'k',
    tasks,
  });
  expect(res.success).toBe(true);
});

test('§8.2 bad base_url → invalid (invalid_url)', () => {
  const res = AiConnectionSchema.safeParse({
    provider: 'openai_compatible',
    base_url: 'not a url',
    api_key: 'k',
    tasks,
  });
  expect(res.success).toBe(false);
  if (!res.success) {
    const issue = res.error.issues.find((i) => i.path.join('.') === 'base_url');
    expect(issue?.message).toBe('invalid_url');
  }
});

test('§8.3 redaction strips the key and exposes api_key_set', () => {
  const read = redact({
    provider: 'openai_compatible',
    base_url: 'https://x/v1',
    api_key: 'k',
    tasks,
  });
  expect(read).toEqual({
    provider: 'openai_compatible',
    base_url: 'https://x/v1',
    api_key_set: true,
    tasks,
    avoidances: '', // B-216: not a secret; '' when unset
  });
  expect(read).not.toHaveProperty('api_key');
  expect(read?.tasks).toBe(tasks); // unchanged, passed through
  expect(redact(null)).toBeNull();
  // empty / absent stored key → api_key_set:false
  expect(
    redact({ provider: 'openai_compatible', base_url: 'https://x/v1', tasks })?.api_key_set,
  ).toBe(false);
});

test('§8.4 merge keeps the key', () => {
  const stored: AiConnection = {
    provider: 'openai_compatible',
    base_url: 'https://x/v1',
    api_key: 'k',
    tasks,
  };
  const merged = mergeAi(stored, { base_url: 'https://y' });
  expect(merged.base_url).toBe('https://y');
  expect(merged.api_key).toBe('k');
});

test('§8.5 merge clears the key', () => {
  const stored: AiConnection = {
    provider: 'openai_compatible',
    base_url: 'https://x/v1',
    api_key: 'k',
    tasks,
  };
  const merged = mergeAi(stored, { api_key: '' });
  expect(merged.api_key).toBeUndefined();
  expect(redact(merged)?.api_key_set).toBe(false);
});

test('§8.6 per-task merge touches only the named task+field', () => {
  const stored: AiConnection = {
    provider: 'openai_compatible',
    base_url: 'https://x/v1',
    api_key: 'k',
    tasks: {
      dish_photo_macros: { model: 'm1', prompt: 'p1' },
      meal_suggestions: { model: 'm2', prompt: 'p2' },
      advice: { model: 'm3', prompt: 'p3' },
    },
  };
  const merged = mergeAi(stored, { tasks: { advice: { prompt: 'New scope' } } });
  expect(merged.tasks.advice.prompt).toBe('New scope');
  expect(merged.tasks.advice.model).toBe('m3'); // unchanged
  expect(merged.tasks.dish_photo_macros).toEqual({ model: 'm1', prompt: 'p1' });
  expect(merged.tasks.meal_suggestions).toEqual({ model: 'm2', prompt: 'p2' });
});

test('§8.6b blank prompt is normalised to the default, never stored blank', () => {
  const stored: AiConnection = {
    provider: 'openai_compatible',
    base_url: 'https://x/v1',
    tasks,
  };
  const merged = mergeAi(stored, { tasks: { advice: { prompt: '   ' } } });
  expect(merged.tasks.advice.prompt).toBe(defaultTaskPrompt('advice'));
});

test('§8.7 default prompt is the English advice scope (locale-independent, B-202)', () => {
  // Tone + data usage only; the format (Markdown) + language live in the app, not the prompt.
  expect(defaultTaskPrompt('advice')).toContain('supportive nutrition coach');
  expect(defaultTaskPrompt('advice')).toContain('never paternalistic');
});

test('§8.8 avoidances (B-216): validated, redacted unredacted, merge replaces/keeps/clears', () => {
  const stored: AiConnection = {
    provider: 'openai_compatible',
    base_url: 'https://x/v1',
    api_key: 'k',
    tasks,
    avoidances: 'peanuts',
  };
  // Schema accepts the field and enforces its length bound.
  expect(AiConnectionSchema.safeParse(stored).success).toBe(true);
  expect(AiConnectionSchema.safeParse({ ...stored, avoidances: 'x'.repeat(1001) }).success).toBe(
    false,
  );
  // Redaction returns it as-is (not a secret); unset → ''.
  expect(redact(stored)?.avoidances).toBe('peanuts');
  expect(
    redact({ provider: 'openai_compatible', base_url: 'https://x/v1', tasks })?.avoidances,
  ).toBe('');
  // Merge: absent keeps, a value replaces, '' clears.
  expect(mergeAi(stored, { base_url: 'https://y' }).avoidances).toBe('peanuts');
  expect(mergeAi(stored, { avoidances: 'shellfish' }).avoidances).toBe('shellfish');
  expect(mergeAi(stored, { avoidances: '' }).avoidances).toBe('');
});
