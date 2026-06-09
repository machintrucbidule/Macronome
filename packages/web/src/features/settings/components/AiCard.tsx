import { useTranslation } from 'react-i18next';
import { AI_TASK_KEYS, isVisionModel } from '@macronome/shared';
import { Button } from '../../../components/Button/Button';
import { Banner } from '../../../components/Banner/Banner';
import { useAiConnectionForm } from '../useAiConnectionForm';
import { AiConnectionFields } from './AiConnectionFields';
import { AiTaskBlock } from './AiTaskBlock';
import { AiHelp } from './AiHelp';
import styles from '../settings.module.css';

// Assistant IA card (design/components/ai-connection.md): configure + verify the remote
// OpenAI-compatible link. Base URL + write-only key, a "Fetch models" action that doubles as
// the connection proof, and three per-task model/prompt blocks. Renders; never computes.
export function AiCard() {
  const { t } = useTranslation();
  const f = useAiConnectionForm();

  return (
    <div className={styles.card}>
      <div className={styles.ch}>
        <span className={styles.t}>{t('settings.ai.title')}</span>
      </div>
      <div className={`${styles.cb} ${styles.aiBody}`}>
        <p className={styles.aiIntro}>{t('settings.ai.intro')}</p>

        <AiConnectionFields f={f} />

        <div className={styles.aiFetch}>
          <Button
            variant="ghost"
            onMouseDown={(e) => e.preventDefault()}
            onClick={f.runFetchModels}
            disabled={f.fetchPending}
          >
            {f.fetchPending ? t('settings.ai.fetchingModels') : t('settings.ai.fetchModels')}
          </Button>
          {f.fetchSuccess && (
            <span className={styles.aiNote}>
              {t('settings.ai.modelsCount', { count: f.models.length })}
            </span>
          )}
        </div>
        {f.fetchError && <Banner tone="warning">{t(`settings.ai.errors.${f.fetchError}`)}</Banner>}

        {AI_TASK_KEYS.map((key) => (
          <AiTaskBlock
            key={key}
            taskKey={key}
            model={f.tasks[key].model}
            prompt={f.tasks[key].prompt}
            // The dish-photo task needs an image-capable model; hide the others (B-118 follow-up).
            models={key === 'dish_photo_macros' ? f.models.filter(isVisionModel) : f.models}
            onModel={(model) => f.setTask(key, { model })}
            onPrompt={(prompt) => f.setTask(key, { prompt })}
          />
        ))}

        <AiHelp />

        <div className={styles.aiActions}>
          <Button
            onMouseDown={(e) => e.preventDefault()}
            onClick={f.onSave}
            disabled={f.savePending}
          >
            {t('settings.ai.save')}
          </Button>
        </div>
      </div>
    </div>
  );
}
