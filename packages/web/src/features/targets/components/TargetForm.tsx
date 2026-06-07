import { useTranslation } from 'react-i18next';
import type { EngineReadout, TargetVersion } from '@macronome/shared';
import { Button } from '../../../components/Button/Button';
import { TargetFields } from './TargetFields';
import { shortDate } from '../format';
import type { TargetDraft } from '../draft';
import styles from '../cibles.module.css';

// Left column — "Mes cibles" (manual) doubling as the history editor (TH-1 / B-091). In
// create mode it POSTs a new version effective from the chosen date; loading a history row
// switches to edit mode (PATCH that row) and, for a past version, surfaces a freeze notice
// + the opt-in recompute. The calorie range + macro ratios are the only edited values; the
// engine tiles always come from the server (rule 2).
interface TargetFormProps {
  draft: TargetDraft;
  set: (patch: Partial<TargetDraft>) => void;
  engine: EngineReadout;
  editing: TargetVersion | null;
  onSave: () => void;
  onSuggest: () => void;
  onNewTarget: () => void;
  onBackToCurrent: () => void;
  onDelete: () => void;
  onRecompute: () => void;
  recomputeCount: number | null;
  canSave: boolean;
  saving: boolean;
}

export function TargetForm(props: TargetFormProps) {
  const { draft, set, engine, editing, canSave, saving } = props;
  const { t, i18n } = useTranslation();
  const isPast = editing !== null && editing.until !== null;
  const title = editing
    ? t('cibles.history.modeEditing', { date: shortDate(editing.effective_from, i18n.language) })
    : t('cibles.history.modeCurrent');

  return (
    <section className={styles.column}>
      <header className={styles.colHead}>
        <h2>{title}</h2>
        <span className={styles.badge}>{t('cibles.badge.manual')}</span>
      </header>

      <div className={styles.editorBar}>
        {editing ? (
          <button type="button" className={styles.linkBtn} onClick={props.onBackToCurrent}>
            ← {t('cibles.history.backToCurrent')}
          </button>
        ) : (
          <button type="button" className={styles.linkBtn} onClick={props.onNewTarget}>
            ＋ {t('cibles.history.newTarget')}
          </button>
        )}
      </div>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>{t('cibles.history.effectiveFrom')}</span>
        <input
          type="date"
          className={styles.dateInput}
          value={draft.effectiveFrom}
          onChange={(e) => set({ effectiveFrom: e.target.value })}
        />
      </label>

      <TargetFields draft={draft} set={set} engine={engine} />

      {isPast && (
        <div className={styles.freezeNotice}>
          <p>{t('cibles.recompute.notice')}</p>
          <Button
            variant="ghost"
            onClick={props.onRecompute}
            disabled={props.recomputeCount === null || props.recomputeCount === 0}
          >
            {props.recomputeCount === null
              ? t('cibles.recompute.loading')
              : t('cibles.recompute.button', { count: props.recomputeCount })}
          </Button>
        </div>
      )}

      <div className={styles.actions}>
        {editing ? (
          <Button variant="danger" onClick={props.onDelete}>
            {t('cibles.history.delete')}
          </Button>
        ) : (
          <Button variant="ghost" onClick={props.onSuggest}>
            {t('cibles.suggest.open')}
          </Button>
        )}
        <Button onClick={props.onSave} disabled={!canSave || saving}>
          {editing ? t('cibles.history.update') : t('common.save')}
        </Button>
      </div>
    </section>
  );
}
