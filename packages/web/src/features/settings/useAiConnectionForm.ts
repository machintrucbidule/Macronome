import { useEffect, useState } from 'react';
import {
  AI_TASK_KEYS,
  defaultTaskPrompt,
  type AiConnectionPatch,
  type AiConnectionRead,
  type AiTaskKey,
} from '@macronome/shared';
import { ApiError } from '../../api/client';
import { notify } from '../../components/Toast/notify';
import { useAiModelsMutation, useSettingsMutation, useSettingsQuery } from './useSettings';

// State + handlers for the Assistant IA card (design/components/ai-connection.md). Seeds a
// local draft from the redacted server config, runs the model-list fetch (the connection
// proof), and saves a deep-merge patch. The api_key is write-only: omitted unless the user
// touched the field (then '' clears, a value (re)defines it — ai-connection.md §4).
const KNOWN_AI_ERRORS = new Set([
  'ai_not_configured',
  'ai_unauthorized',
  'ai_unreachable',
  'ai_bad_response',
  'ai_rate_limited',
  'ai_unavailable',
]);

type TaskDraft = Record<AiTaskKey, { model: string | null; prompt: string }>;

function seedTasks(ai: AiConnectionRead | null): TaskDraft {
  const draft = {} as TaskDraft;
  for (const key of AI_TASK_KEYS) {
    const stored = ai?.tasks[key];
    draft[key] = { model: stored?.model ?? null, prompt: stored?.prompt ?? defaultTaskPrompt(key) };
  }
  return draft;
}

function buildPatch(
  baseUrl: string,
  apiKey: string,
  keyDirty: boolean,
  tasks: TaskDraft,
  avoidances: string,
): AiConnectionPatch {
  const patch: AiConnectionPatch = {
    provider: 'openai_compatible',
    base_url: baseUrl,
    tasks: {
      dish_photo_macros: tasks.dish_photo_macros,
      meal_suggestions: tasks.meal_suggestions,
      advice: tasks.advice,
    },
    avoidances, // B-216: allergies / disliked foods ('' clears it)
  };
  if (keyDirty) patch.api_key = apiKey;
  return patch;
}

export function useAiConnectionForm() {
  const ai = useSettingsQuery().data?.data.ai ?? null;
  const save = useSettingsMutation();
  const fetchModels = useAiModelsMutation();

  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [keyDirty, setKeyDirty] = useState(false);
  const [tasks, setTasks] = useState<TaskDraft>(() => seedTasks(null));
  const [avoidances, setAvoidances] = useState('');
  const [models, setModels] = useState<string[]>([]);
  const [baseUrlInvalid, setBaseUrlInvalid] = useState(false);

  // (Re)seed the draft whenever the server config changes (initial load + after a save).
  const seedKey = JSON.stringify(ai);
  useEffect(() => {
    const parsed: AiConnectionRead | null =
      seedKey === 'null' ? null : (JSON.parse(seedKey) as AiConnectionRead);
    setBaseUrl(parsed?.base_url ?? '');
    setTasks(seedTasks(parsed));
    setAvoidances(parsed?.avoidances ?? '');
    setApiKey('');
    setKeyDirty(false);
    setBaseUrlInvalid(false);
  }, [seedKey]);

  const setApiKeyValue = (value: string): void => {
    setApiKey(value);
    setKeyDirty(true);
  };
  const setTask = (
    key: AiTaskKey,
    patch: Partial<{ model: string | null; prompt: string }>,
  ): void => setTasks((cur) => ({ ...cur, [key]: { ...cur[key], ...patch } }));

  // Persist the current draft; returns false (and marks the URL invalid) on a 422 so callers
  // can stop. Used by both "Enregistrer" and the save-then-fetch action below.
  const persist = async (): Promise<boolean> => {
    setBaseUrlInvalid(false);
    try {
      await save.mutateAsync({ ai: buildPatch(baseUrl, apiKey, keyDirty, tasks, avoidances) });
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.details?.['ai.base_url'] === 'invalid_url') {
        setBaseUrlInvalid(true);
      }
      return false;
    }
  };

  // B-261: the explicit "Enregistrer" confirms; `runFetchModels` below persists too but already
  // shows its own result, so only the bare save toasts.
  const onSave = (): void => {
    void persist().then((ok) => {
      if (ok) notify('settingsSaved');
    });
  };

  // "Récupérer les modèles" saves the typed config first, then proves the link against it, so
  // the test always reflects what is on screen (no silent "save first" gotcha).
  const runFetchModels = (): void => {
    void (async () => {
      if (!(await persist())) return;
      fetchModels.mutate(undefined, { onSuccess: (res) => setModels(res.data.map((m) => m.id)) });
    })();
  };

  const fetchError =
    fetchModels.error instanceof ApiError && KNOWN_AI_ERRORS.has(fetchModels.error.code)
      ? fetchModels.error.code
      : null;

  return {
    baseUrl,
    setBaseUrl,
    apiKey,
    setApiKeyValue,
    apiKeySet: ai?.api_key_set ?? false,
    keyDirty,
    tasks,
    setTask,
    avoidances,
    setAvoidances,
    models,
    baseUrlInvalid,
    runFetchModels,
    fetchPending: save.isPending || fetchModels.isPending,
    fetchSuccess: fetchModels.isSuccess,
    fetchError,
    onSave,
    savePending: save.isPending,
  };
}
