import { useTranslation } from 'react-i18next';
import type { EngineReadout } from '@macronome/shared';
import { MetricCard } from '../../../components/MetricCard/MetricCard';
import { macroG } from '../format';
import styles from '../cibles.module.css';

// The three derived-macro target tiles (protein floor ≥, fat floor ≥, carb ceiling ≤),
// macro-colour-coded per the Cibles mockup. Split out of EnginePanel for modularity.
const DASH = '—';
const showG = (n: number | null): string => (n === null ? DASH : macroG(n));

interface MacroFloorTilesProps {
  engine: EngineReadout;
  carbWarn: boolean;
}

export function MacroFloorTiles({ engine, carbWarn }: MacroFloorTilesProps) {
  const { t } = useTranslation();
  return (
    <div className={styles.tiles3}>
      <MetricCard
        label={t('cibles.engine.proteinFloor')}
        value={showG(engine.protein_floor_g)}
        unit="g"
        note={t('cibles.engine.floorNote')}
        accent="prot"
      />
      <MetricCard
        label={t('cibles.engine.fatFloor')}
        value={showG(engine.fat_floor_g)}
        unit="g"
        accent="fat"
      />
      <MetricCard
        label={t('cibles.engine.carbCeiling')}
        value={showG(engine.carb_ceiling_g)}
        unit="g"
        tone={carbWarn ? 'warn' : 'default'}
        accent="carb"
      />
    </div>
  );
}
