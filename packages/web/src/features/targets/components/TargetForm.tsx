import { useTranslation } from 'react-i18next';
import type { EngineReadout } from '@macronome/shared';
import { Button } from '../../../components/Button/Button';
import { TargetFields } from './TargetFields';
import type { TargetDraft } from '../draft';
import styles from '../cibles.module.css';

// Left column — "Mes cibles" (manual). The calorie range + macro ratios are the only
// values the user edits; saving POSTs a new target row and the engine tiles then refresh
// from GET /target. The body fields live in TargetFields. The engine readout is threaded
// in for the derived left-column read-outs (carb ceiling, target BMI).
interface TargetFormProps {
  draft: TargetDraft;
  set: (patch: Partial<TargetDraft>) => void;
  engine: EngineReadout;
  onSave: () => void;
  onSuggest: () => void;
  canSave: boolean;
  saving: boolean;
}

export function TargetForm({
  draft,
  set,
  engine,
  onSave,
  onSuggest,
  canSave,
  saving,
}: TargetFormProps) {
  const { t } = useTranslation();
  return (
    <section className={styles.column}>
      <header className={styles.colHead}>
        <h2>{t('cibles.targets.title')}</h2>
        <span className={styles.badge}>{t('cibles.badge.manual')}</span>
      </header>

      <TargetFields draft={draft} set={set} engine={engine} />

      <div className={styles.actions}>
        <Button variant="ghost" onClick={onSuggest}>
          {t('cibles.suggest.open')}
        </Button>
        <Button onClick={onSave} disabled={!canSave || saving}>
          {t('common.save')}
        </Button>
      </div>
    </section>
  );
}
