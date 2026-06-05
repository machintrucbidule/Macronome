import { useTranslation } from 'react-i18next';
import { r0 } from '../../format';
import styles from '../modals.module.css';

// Leftover weight inputs + net readout (split out of LeftoverModal to keep that component
// focused/small). Gross weight is editable; the container is the built-in "Rien" until the
// Containers catalog (tares) wires real options. Net is computed by the parent (never here).
interface LeftoverFieldsProps {
  fieldId: string;
  gross: string;
  onGross: (v: string) => void;
  net: number;
}

export function LeftoverFields({ fieldId, gross, onGross, net }: LeftoverFieldsProps) {
  const { t } = useTranslation();
  return (
    <>
      <div className={styles.loGrid}>
        <div className={styles.loField}>
          <label htmlFor={`${fieldId}-gross`}>{t('meals.leftover.gross')}</label>
          <input
            id={`${fieldId}-gross`}
            type="number"
            data-testid="lo-gross"
            value={gross}
            onChange={(e) => onGross(e.target.value)}
          />
        </div>
        <div className={styles.loField}>
          <label htmlFor={`${fieldId}-container`}>{t('meals.leftover.container')}</label>
          <select id={`${fieldId}-container`} disabled>
            <option>{t('meals.leftover.none')}</option>
          </select>
        </div>
      </div>
      <div className={styles.loNet}>
        {t('meals.leftover.net')} <b>{r0(net)} g</b>
      </div>
    </>
  );
}
