import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { DayDetail } from '@macronome/shared';
import { useSettingsQuery } from '../../settings/useSettings';
import { useMeals } from '../MealsContext';
import type { MealSelection } from '../hooks/useMealSelection';
import { r0 } from '../format';
import { AiProposalsDialog } from '../modals/AiProposalsDialog';
import styles from '../meals.module.css';

// Centered Σ readout (B-207), shown only in selection mode: an empty selection shows a hint, else
// the summed grams · kcal · L/G/P (each via r0), mirroring the meal-footer figures.
function SumReadout({ selection }: { selection: MealSelection }) {
  const { t } = useTranslation();
  if (!selection.mode) return null;
  if (selection.selected.size === 0)
    return <span className={styles.sumHint}>{t('meals.sum.empty')}</span>;
  const s = selection.sum;
  // Order + styling mirror the meal lines / footer: grams (qté) · kcal (bold) · L/G/P colour-coded.
  return (
    <span className={styles.sumReadout}>
      <span className={styles.sumSigma}>Σ</span>
      <span>
        {r0(s.grams)} {t('meals.sum.grams')}
      </span>
      <span className={styles.sumKcal}>
        {r0(s.kcal)} {t('meals.col.kcal')}
      </span>
      <span className={styles.sumFat}>
        {t('meals.col.fat')} {r0(s.fat)}
      </span>
      <span className={styles.sumCarb}>
        {t('meals.col.carb')} {r0(s.carb)}
      </span>
      <span className={styles.sumProt}>
        {t('meals.col.protein')} {r0(s.protein)}
      </span>
    </span>
  );
}

// The centered readout + the Σ toggle (B-207), extracted so MealsControls stays within the line cap.
function SelectionBar({ selection }: { selection: MealSelection }) {
  const { t } = useTranslation();
  return (
    <>
      <span className={styles.ctrlSpacer}>
        <SumReadout selection={selection} />
      </span>
      <button
        type="button"
        className={`${styles.sumToggle}${selection.mode ? ` ${styles.sumToggleOn}` : ''}`}
        onClick={selection.toggleMode}
        aria-pressed={selection.mode}
        title={t('meals.sum.toggle')}
        aria-label={t('meals.sum.toggle')}
      >
        Σ
      </button>
    </>
  );
}

// Controls row above the meal scroller: the ✨ Proposition IA button (B-123), Copier hier
// (B-082), Tout effacer (B-046), and + Repas. Kept out of MealsPage so the page stays a thin
// route container. Add-meal uses prompt().
interface Props {
  day: DayDetail;
  date: string;
  onClear: () => void;
  onCopyYesterday: () => void;
  onAddMeal: (name: string) => void;
  // Line-level undo/redo (UR-1 / B-133): driven by the controller's history stack.
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function MealsControls({
  day,
  date,
  onClear,
  onCopyYesterday,
  onAddMeal,
  undo,
  redo,
  canUndo,
  canRedo,
}: Props) {
  const { t } = useTranslation();
  const [showProposals, setShowProposals] = useState(false);
  const { selection } = useMeals();
  const settings = useSettingsQuery().data?.data;
  // The meal-suggestions endpoint needs a connection AND a model for this task (else 409). Gate
  // the button on the same condition (D7); stay optimistic while settings are still loading.
  const aiReady = settings
    ? !!settings.ai && settings.ai.tasks.meal_suggestions.model !== null
    : true;

  const promptAddMeal = (): void => {
    const name = window.prompt(t('meals.meal.addPrompt'));
    if (name) onAddMeal(name);
  };

  return (
    <div className={styles.controls}>
      <button
        type="button"
        className={styles.aiBtn}
        disabled={!aiReady}
        onClick={() => setShowProposals(true)}
      >
        <span className={styles.aiSpark}>✨</span> {t('meals.proposals.button')}
      </button>
      {!aiReady && (
        <span className={styles.aiOffHint}>
          {t('meals.proposals.notConfigured')} —{' '}
          <Link to="/parametres">{t('meals.proposals.configureLink')}</Link>
        </span>
      )}
      <SelectionBar selection={selection} />
      <button
        type="button"
        className={styles.histBtn}
        onClick={undo}
        disabled={!canUndo}
        title={t('meals.undo')}
        aria-label={t('meals.undo')}
      >
        ↶
      </button>
      <button
        type="button"
        className={styles.histBtn}
        onClick={redo}
        disabled={!canRedo}
        title={t('meals.redo')}
        aria-label={t('meals.redo')}
      >
        ↷
      </button>
      <button type="button" className={styles.copyDay} onClick={onCopyYesterday}>
        {t('meals.copyYesterday')}
      </button>
      <button type="button" className={styles.clearAll} onClick={onClear}>
        {t('meals.clearAll')}
      </button>
      <button type="button" className={styles.addMeal} onClick={promptAddMeal}>
        {t('meals.addMeal')}
      </button>
      {showProposals && (
        <AiProposalsDialog day={day} date={date} onClose={() => setShowProposals(false)} />
      )}
    </div>
  );
}
