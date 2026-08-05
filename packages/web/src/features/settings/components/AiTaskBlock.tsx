import { useTranslation } from 'react-i18next';
import { defaultTaskPrompt, type AiTaskKey } from '@macronome/shared';
import { Textarea } from '../../../components/Form/Textarea';
import { SelectMenu } from '../../../components/SelectMenu/SelectMenu';
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
        <SelectMenu
          variant="field"
          disabled={noModels}
          ariaLabel={t('settings.ai.model')}
          menuClassName={styles.aiModelMenu}
          value={model ?? ''}
          // With no model list there is nothing to match, so the trigger falls back to the
          // placeholder — same readout the disabled native select used to show.
          placeholder={t('settings.ai.modelPlaceholder')}
          options={
            noModels
              ? []
              : [{ value: '', label: '—' }, ...options.map((id) => ({ value: id, label: id }))]
          }
          onChange={(v) => onModel(v === '' ? null : v)}
        />
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
        <Textarea mono rows={3} value={prompt} onChange={(e) => onPrompt(e.target.value)} />
        <span className={styles.aiNote}>{t('settings.ai.promptNote')}</span>
        <AiCostEstimate taskKey={taskKey} />
      </label>
    </div>
  );
}
