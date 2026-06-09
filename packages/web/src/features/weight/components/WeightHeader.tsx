import { useTranslation } from 'react-i18next';
import type { DietFlag } from '@macronome/shared';
import { Button } from '../../../components/Button/Button';
import { FlagToggle } from './FlagToggle';
import styles from '../weight.module.css';

// Poids header: title, the screen-local current-mode toggle (Régime/Maintien — ephemeral in
// M4), and the "+ Pesée" entry button. The mode pre-selects a new weigh-in's flag and gates
// the projection display; it is local to this screen (screens/weight.md §Mode).
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
