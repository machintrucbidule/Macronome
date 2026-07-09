import { useTranslation } from 'react-i18next';
import { defaultTaskPrompt, type AiTaskKey } from '@macronome/shared';
import { AiCostEstimate } from './AiCostEstimate';
import styles from '../settings.module.css';

// One per-task block of the Assistant IA card (design/components/ai-connection.md §Per-task
// blocks). A model picker (disabled until the model list is fetched) + an English prompt
// textarea with a "Reset to default" link. Renders; the parent holds the config state.
interface AiTaskBlockProps {
  taskKey: AiTaskKey;
  model: string | null;
  prompt: string;
  models: string[];
  onModel: (model: string | null) => void;
  onPrompt: (prompt: string) => void;
}

export function AiTaskBlock({
  taskKey,
  model,
  prompt,
  models,
  onModel,
  onPrompt,
}: AiTaskBlockProps) {
  const { t } = useTranslation();
  const noModels = models.length === 0;
  // Keep the stored model selectable even if it is not in the freshly-fetched list.
  const options = model && !models.includes(model) ? [model, ...models] : models;

  return (
    <div className={styles.aiTask}>
      <div className={styles.aiTaskName}>{t(`settings.ai.tasks.${taskKey}`)}</div>
      <label className={styles.aiField}>
        <span className={styles.aiFieldLabel}>{t('settings.ai.model')}</span>
        <select
          className={styles.aiSelect}
          value={model ?? ''}
          disabled={noModels}
          aria-label={t('settings.ai.model')}
          onChange={(e) => onModel(e.target.value === '' ? null : e.target.value)}
        >
          <option value="">{noModels ? t('settings.ai.modelPlaceholder') : '—'}</option>
          {options.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.aiField}>
        <span className={styles.aiFieldLabel}>
          {t('settings.ai.prompt')}
          <button
            type="button"
            className={styles.aiReset}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPrompt(defaultTaskPrompt(taskKey))}
          >
            {t('settings.ai.reset')}
          </button>
        </span>
        <textarea
          className={styles.aiTextarea}
          rows={3}
          value={prompt}
          onChange={(e) => onPrompt(e.target.value)}
        />
        <span className={styles.aiNote}>{t('settings.ai.promptNote')}</span>
        <AiCostEstimate taskKey={taskKey} />
      </label>
    </div>
  );
}
