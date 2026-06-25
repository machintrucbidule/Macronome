import { useTranslation } from 'react-i18next';
import type { DietFlag } from '@macronome/shared';
import { Button } from '../../../components/Button/Button';
import { FlagToggle } from './FlagToggle';
import styles from '../weight.module.css';

// Poids header: title, the current-mode toggle (Régime/Maintien — persisted on app_user.settings
// in M7, see useWeightMode), and the "+ Pesée" entry button. The mode pre-selects a new weigh-in's
// flag and gates the projection display (screens/weight.md §Mode).
interface WeightHeaderProps {
  mode: DietFlag | null;
  onMode: (m: DietFlag) => void;
  onAdd: () => void;
  onExport: () => void;
}

export function WeightHeader({ mode, onMode, onAdd, onExport }: WeightHeaderProps) {
  const { t } = useTranslation();
  return (
    <div className={styles.head}>
      <h1>{t('weight.title')}</h1>
      <div className={styles.headActions}>
        {mode && (
          <span className={styles.modeLabel}>
            {t('weight.mode.label')}
            <FlagToggle value={mode} onChange={onMode} />
          </span>
        )}
        <Button variant="ghost" onClick={onExport}>
          {t('weight.exportCsv')}
        </Button>
        <Button onClick={onAdd}>{t('weight.add')}</Button>
      </div>
    </div>
  );
}
