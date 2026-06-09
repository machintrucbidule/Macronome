import {
  AI_TASK_KEYS,
  defaultTaskPrompt,
  type AiConnection,
  type AiConnectionPatch,
  type AiTaskKey,
} from '@macronome/shared';

// Deep-merge of a partial AI config onto the stored one (spec/logic/ai-connection.md §4),
// with prompt normalisation (§2/§3: a blank prompt is replaced by the default, never stored
// blank). A `null` stored config is seeded with default-prompt tasks so a partial patch still
// yields a complete config.

function seedTasks(): AiConnection['tasks'] {
  return {
    dish_photo_macros: { model: null, prompt: defaultTaskPrompt('dish_photo_macros') },
    meal_suggestions: { model: null, prompt: defaultTaskPrompt('meal_suggestions') },
    advice: { model: null, prompt: defaultTaskPrompt('advice') },
  };
}

/** api_key: absent ⇒ keep; '' or null ⇒ clear (undefined); else replace. */
function resolveApiKey(stored: string | undefined, patch: AiConnectionPatch): string | undefined {
  if (patch.api_key === undefined) return stored;
  return patch.api_key === null || patch.api_key.trim() === '' ? undefined : patch.api_key;
}

/** Merge one task's fields; a blank prompt falls back to the task default. */
function mergeTask(
  key: AiTaskKey,
  cur: AiConnection['tasks'][AiTaskKey],
  patch: AiConnectionPatch['tasks'],
): AiConnection['tasks'][AiTaskKey] {
  const tp = patch?.[key];
  if (!tp) return cur;
  const model = tp.model !== undefined ? tp.model : cur.model;
  const rawPrompt = tp.prompt !== undefined ? tp.prompt : cur.prompt;
  return { model, prompt: rawPrompt.trim() === '' ? defaultTaskPrompt(key) : rawPrompt };
}

export function mergeAi(stored: AiConnection | null, patch: AiConnectionPatch): AiConnection {
  const base: AiConnection = stored ?? {
    provider: 'openai_compatible',
    base_url: '',
    tasks: seedTasks(),
  };

  const tasks = { ...base.tasks };
  for (const key of AI_TASK_KEYS) {
    tasks[key] = mergeTask(key, base.tasks[key], patch.tasks);
  }

  const result: AiConnection = {
    provider: patch.provider ?? base.provider,
    base_url: patch.base_url ?? base.base_url,
    tasks,
  };
  const api_key = resolveApiKey(base.api_key, patch);
  if (api_key !== undefined) result.api_key = api_key;
  return result;
}
