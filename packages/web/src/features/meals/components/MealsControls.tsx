import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { DayDetail } from '@macronome/shared';
import { useSettingsQuery } from '../../settings/useSettings';
import { AiProposalsDialog } from '../modals/AiProposalsDialog';
import styles from '../meals.module.css';

// Controls row above the meal scroller: the ✨ Proposition IA button (B-123), Copier hier
// (B-082), Tout effacer (B-046), and + Repas. Kept out of MealsPage so the page stays a thin
// route container. Add-meal uses prompt().
interface Props {
  day: DayDetail;
  date: string;
  onClear: () => void;
  onCopyYesterday: () => void;
  onAddMeal: (name: string) => void;
}

export function MealsControls({ day, date, onClear, onCopyYesterday, onAddMeal }: Props) {
  const { t } = useTranslation();
  const [showProposals, setShowProposals] = useState(false);
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
      <span className={styles.ctrlSpacer} />
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
