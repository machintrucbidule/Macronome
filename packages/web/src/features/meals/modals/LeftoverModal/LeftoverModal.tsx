import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Meal } from '@macronome/shared';
import { ApiError } from '../../../../api/client';
import { Modal, modalStyles } from '../../../../components/Modal/Modal';
import { Button } from '../../../../components/Button/Button';
import { Banner } from '../../../../components/Banner/Banner';
import { useMeals } from '../../MealsContext';
import { r0 } from '../../format';
import { LineSelector } from './LineSelector';
import { LeftoverFields } from './LeftoverFields';
import { useLeftoverForm } from './useLeftoverForm';
import styles from '../modals.module.css';

// Leftover (plate-deduction) modal. Lists the meal's weighed lines, takes the gross weight and
// a container (tare), and applies via the API — which prorates and freezes the container value.
// Proration is NEVER computed here; on apply the day refetches and the consumed values update.
// Block-and-warn: a client guard disables Appliquer when gross < tare or net > served (the server
// also enforces 409 gross_below_tare / leftover_exceeds_served, writing nothing). The container
// picker lists the user's tare catalog (incl. the locked built-in "Rien", 0 g); the chosen tare
// drives the net preview and is frozen server-side on apply.
interface LeftoverModalProps {
  meal: Meal;
}

interface ApplyArgs {
  mealId: string;
  grossNum: number;
  containerId: string | null;
  entryIds: string[];
  create: (v: {
    mealId: string;
    body: { container_id: string | null; gross_grams: number; entry_ids: string[] };
  }) => Promise<unknown>;
  onDone: () => void;
  onError: (code: string) => void;
}

async function applyLeftover({
  mealId,
  grossNum,
  containerId,
  entryIds,
  create,
  onDone,
  onError,
}: ApplyArgs): Promise<void> {
  try {
    await create({
      mealId,
      body: { container_id: containerId, gross_grams: grossNum, entry_ids: entryIds },
    });
    onDone();
  } catch (e) {
    onError(e instanceof ApiError ? e.code : 'request_failed');
  }
}

export function LeftoverModal({ meal }: LeftoverModalProps) {
  const { t } = useTranslation();
  const { actions, mutations } = useMeals();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useLeftoverForm(meal);
  const {
    fieldId,
    containers,
    eligible,
    selected,
    toggle,
    gross,
    setGross,
    selectedId,
    setContainerId,
    net,
    servedTotal,
    blocked,
    warning,
  } = form;

  const grossNum = Number(gross.replace(',', '.')) || 0;
  const apply = (): Promise<void> =>
    applyLeftover({
      mealId: meal.id,
      grossNum,
      containerId: selectedId,
      entryIds: [...selected],
      create: mutations.createLeftover.mutateAsync,
      onDone: actions.closeLeftover,
      onError: setServerError,
    });

  return (
    <Modal
      title={`${t('meals.leftover.title')} — ${meal.slot_name}`}
      onClose={actions.closeLeftover}
    >
      <p className={modalStyles.sub}>{t('meals.leftover.sub')}</p>
      <div className={modalStyles.body}>
        <LineSelector entries={eligible} selected={selected} onToggle={toggle} />
        <div className={styles.loSel}>
          {t('meals.leftover.selection', { count: selected.size })} · <b>{r0(servedTotal)}</b> g
        </div>
        <LeftoverFields
          fieldId={fieldId}
          gross={gross}
          onGross={setGross}
          net={net}
          containers={containers}
          containerId={selectedId}
          onContainer={setContainerId}
        />
        {warning && <Banner tone="warning">{warning}</Banner>}
        {serverError && <Banner tone="warning">{t('meals.leftover.serverError')}</Banner>}
      </div>
      <div className={modalStyles.actions}>
        <span className={modalStyles.actionsRight}>
          <Button variant="ghost" onClick={actions.closeLeftover}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={blocked || mutations.createLeftover.isPending}
            onClick={() => void apply()}
          >
            {t('meals.leftover.apply')}
          </Button>
        </span>
      </div>
    </Modal>
  );
}
