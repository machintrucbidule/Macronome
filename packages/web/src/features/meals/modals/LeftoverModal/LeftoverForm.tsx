import { useTranslation } from 'react-i18next';
import type { Meal } from '@macronome/shared';
import { modalStyles } from '../../../../components/Modal/Modal';
import { Button } from '../../../../components/Button/Button';
import { Banner } from '../../../../components/Banner/Banner';
import { r0 } from '../../format';
import { LineSelector } from './LineSelector';
import { LeftoverFields } from './LeftoverFields';
import { LeftoverPreview } from './LeftoverPreview';
import { useLeftoverForm, type LeftoverInitial } from './useLeftoverForm';
import { useLeftoverSubmit } from './useLeftoverSubmit';
import styles from '../modals.module.css';

// Leftover create/edit form: line selection, gross + container inputs, the live served →
// consumed preview (server-computed), and the apply/remove actions (in useLeftoverSubmit).
// The block-and-warn guard mirrors the server (nothing written on a block).
interface LeftoverFormProps {
  meal: Meal;
  initial?: LeftoverInitial;
  onDone: () => void;
  onCancel: () => void;
}

export function LeftoverForm({ meal, initial, onDone, onCancel }: LeftoverFormProps) {
  const { t } = useTranslation();
  const form = useLeftoverForm(meal, initial);
  const { apply, remove, serverError, pending } = useLeftoverSubmit(meal, form, onDone, initial);
  const isEdit = initial !== undefined;
  const selectedEntries = form.eligible.filter((e) => form.selected.has(e.id));

  return (
    <>
      <p className={modalStyles.sub}>{t('meals.leftover.sub')}</p>
      <div className={modalStyles.body}>
        <LineSelector entries={form.eligible} selected={form.selected} onToggle={form.toggle} />
        <div className={styles.loSel}>
          {t('meals.leftover.selection', { count: form.selected.size })} ·{' '}
          <b>{r0(form.servedTotal)}</b> g
        </div>
        <LeftoverFields
          fieldId={form.fieldId}
          gross={form.gross}
          onGross={form.setGross}
          net={form.net}
          options={form.containerOptions}
          containerId={form.selectedId}
          onContainer={form.setContainerId}
        />
        <LeftoverPreview entries={selectedEntries} lines={form.previewLines} />
        {form.warning && <Banner tone="warning">{form.warning}</Banner>}
        {serverError && <Banner tone="warning">{t('meals.leftover.serverError')}</Banner>}
      </div>
      <div className={modalStyles.actions}>
        {isEdit && (
          <Button variant="danger" disabled={pending} onClick={() => void remove()}>
            {t('meals.leftover.remove')}
          </Button>
        )}
        <span className={modalStyles.actionsRight}>
          <Button variant="ghost" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" disabled={form.blocked || pending} onClick={() => void apply()}>
            {isEdit ? t('meals.leftover.save') : t('meals.leftover.apply')}
          </Button>
        </span>
      </div>
    </>
  );
}
