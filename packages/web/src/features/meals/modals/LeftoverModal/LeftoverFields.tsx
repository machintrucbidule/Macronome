import { useTranslation } from 'react-i18next';
import { NumberInput } from '../../../../components/Form/NumberInput';
import { SelectMenu } from '../../../../components/SelectMenu/SelectMenu';
import { r0 } from '../../format';
import styles from '../modals.module.css';

// Leftover weight inputs + net readout (split out of LeftoverModal to keep that component
// focused/small). Gross weight is editable; the container picker lists pre-built options (the
// user's tare catalog incl. the built-in "Rien" 0 g, plus a frozen option on re-edit). Net is
// computed by the parent (never here).
interface LeftoverFieldsProps {
  fieldId: string;
  gross: string;
  onGross: (v: string) => void;
  net: number;
  options: { value: string; label: string }[];
  containerId: string | null;
  onContainer: (id: string) => void;
}

export function LeftoverFields({
  fieldId,
  gross,
  onGross,
  net,
  options,
  containerId,
  onContainer,
}: LeftoverFieldsProps) {
  const { t } = useTranslation();
  return (
    <>
      <div className={styles.loGrid}>
        <div className={styles.loField}>
          <label htmlFor={`${fieldId}-gross`}>{t('meals.leftover.gross')}</label>
          <NumberInput
            id={`${fieldId}-gross`}
            data-testid="lo-gross"
            min={0}
            wrapperClassName={styles.loNum}
            value={gross}
            onChange={(e) => onGross(e.target.value)}
          />
        </div>
        <div className={styles.loField}>
          <span className={styles.loLabel}>{t('meals.leftover.container')}</span>
          <SelectMenu
            variant="field"
            data-testid="lo-container"
            triggerClassName={styles.loTrigger}
            ariaLabel={t('meals.leftover.container')}
            value={containerId ?? ''}
            options={options}
            onChange={onContainer}
          />
        </div>
      </div>
      <div className={styles.loNet}>
        {t('meals.leftover.net')} <b>{r0(net)} g</b>
      </div>
    </>
  );
}
