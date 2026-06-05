import { useTranslation } from 'react-i18next';
import type { Container } from '@macronome/shared';
import { r0 } from '../../format';
import styles from '../modals.module.css';

// Leftover weight inputs + net readout (split out of LeftoverModal to keep that component
// focused/small). Gross weight is editable; the container picker lists the user's tare
// catalog (incl. the built-in "Rien", 0 g). Net is computed by the parent (never here).
interface LeftoverFieldsProps {
  fieldId: string;
  gross: string;
  onGross: (v: string) => void;
  net: number;
  containers: Container[];
  containerId: string | null;
  onContainer: (id: string) => void;
}

export function LeftoverFields({
  fieldId,
  gross,
  onGross,
  net,
  containers,
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
            {containers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({r0(c.empty_weight_g)} g)
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
