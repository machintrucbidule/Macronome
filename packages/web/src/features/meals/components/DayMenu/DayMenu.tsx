import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { DayDetail } from '@macronome/shared';
import { Modal } from '../../../../components/Modal/Modal';
import { useSettingsQuery } from '../../../settings/useSettings';
import { AiProposalsDialog } from '../../modals/AiProposalsDialog';
import styles from './day-menu.module.css';

// Mobile-only "⋯" day menu (spec §5.1). On phones the desktop MealsControls row is hidden (CSS),
// and its rare/secondary day actions move here: + Repas, Copier hier, Vider, undo/redo, and
// ✨ Proposition IA (owner decision 2026-06-11). Self-contained (its own Ai dialog + aiReady gate)
// so MealsControls stays untouched; rendered only when useIsMobile() (in DayHeader), so it never
// appears on desktop. The callbacks are the exact ones MealsPage wires for MealsControls.
export interface DayMenuActions {
  onAddMeal: (name: string) => void;
  onCopyYesterday: () => void;
  onClear: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function DayMenu({
  menu,
  day,
  date,
}: {
  menu: DayMenuActions;
  day: DayDetail;
  date: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [showProposals, setShowProposals] = useState(false);

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        aria-label={t('meals.dayMenu.open')}
        onClick={() => setOpen(true)}
      >
        ⋯
      </button>
      {open && (
        <DayMenuSheet
          menu={menu}
          onClose={() => setOpen(false)}
          onProposals={() => {
            setOpen(false);
            setShowProposals(true);
          }}
        />
      )}
      {/* Kept at this level (not inside the sheet) so opening it doesn't unmount with the sheet. */}
      {showProposals && (
        <AiProposalsDialog day={day} date={date} onClose={() => setShowProposals(false)} />
      )}
    </>
  );
}

// The sheet body. Closes itself before running an action so the sheet doesn't sit over a confirm.
function DayMenuSheet({
  menu,
  onClose,
  onProposals,
}: {
  menu: DayMenuActions;
  onClose: () => void;
  onProposals: () => void;
}) {
  const { t } = useTranslation();
  const settings = useSettingsQuery().data?.data;
  // Same gate as MealsControls (D7): the meal-suggestions task needs a connection + a model.
  const aiReady = settings
    ? !!settings.ai && settings.ai.tasks.meal_suggestions.model !== null
    : true;
  const run = (fn: () => void) => (): void => {
    onClose();
    fn();
  };
  const addMeal = (): void => {
    onClose();
    const name = window.prompt(t('meals.meal.addPrompt'));
    if (name) menu.onAddMeal(name);
  };

  return (
    <Modal title={t('meals.dayMenu.title')} size="confirm" onClose={onClose}>
      <div className={styles.menu}>
        {/* Proposition IA first in the list (owner request 2026-06-11). */}
        <button type="button" className={styles.item} disabled={!aiReady} onClick={onProposals}>
          ✨ {t('meals.proposals.button')}
        </button>
        {!aiReady && (
          <span className={styles.hint}>
            {t('meals.proposals.notConfigured')} —{' '}
            <Link to="/parametres">{t('meals.proposals.configureLink')}</Link>
          </span>
        )}
        <button type="button" className={styles.item} onClick={addMeal}>
          {t('meals.addMeal')}
        </button>
        <button type="button" className={styles.item} onClick={run(menu.onCopyYesterday)}>
          {t('meals.copyYesterday')}
        </button>
        <button
          type="button"
          className={`${styles.item} ${styles.danger}`}
          onClick={run(menu.onClear)}
        >
          {t('meals.clearAll')}
        </button>
        <button
          type="button"
          className={styles.item}
          disabled={!menu.canUndo}
          onClick={run(menu.undo)}
        >
          ↶ {t('meals.undo')}
        </button>
        <button
          type="button"
          className={styles.item}
          disabled={!menu.canRedo}
          onClick={run(menu.redo)}
        >
          ↷ {t('meals.redo')}
        </button>
      </div>
    </Modal>
  );
}
