import { useTranslation } from 'react-i18next';
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
          <input
            id={`${fieldId}-gross`}
            type="number"
            // B-270: this field bypasses the NumberInput primitive, so it declares the phone
            // keypad itself. Decimal — a gross weight can be 812.5 g on a kitchen scale.
            inputMode="decimal"
            data-testid="lo-gross"
            value={gross}
            onChange={(e) => onGross(e.target.value)}
          />
        </div>
        <div className={styles.loField}>
          <label htmlFor={`${fieldId}-container`}>{t('meals.leftover.container')}</label>
          <select
            id={`${fieldId}-container`}
            data-testid="lo-container"
            value={containerId ?? ''}
            onChange={(e) => onContainer(e.target.value)}
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className={styles.loNet}>
        {t('meals.leftover.net')} <b>{r0(net)} g</b>
      </div>
    </>
  );
}
