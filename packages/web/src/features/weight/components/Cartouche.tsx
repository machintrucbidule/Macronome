import { useTranslation } from 'react-i18next';
import type { Cartouche as CartoucheData } from '@macronome/shared';
import { MetricCard } from '../../../components/MetricCard/MetricCard';
import { DASH, bmi1, bmiCategoryKey, kg1, orDash, projectionLabel, signed1 } from '../format';
import styles from '../weight.module.css';

// État header — five stat tiles (design/components/charts.md §Cartouche, screens/weight.md):
// current weight (+Δ), BMI (+category), waist (+Δ), gap to goal, and the goal projection.
// Every figure is server-derived; the web only formats.
export function Cartouche({ data }: { data: CartoucheData }) {
  const { t } = useTranslation();
  const proj = projectionLabel(data.projection);
  const vsPrev = (delta: number | null): string | undefined =>
    delta === null ? undefined : t('weight.cartouche.vsPrev', { delta: signed1(delta) });

  return (
    <div className={styles.cartouche}>
      <MetricCard
        label={t('weight.cartouche.current')}
        value={orDash(data.current, kg1)}
        unit="kg"
        note={vsPrev(data.delta_prev)}
      />
      <MetricCard
        label={t('weight.cartouche.bmi')}
        value={orDash(data.bmi, bmi1)}
        note={data.bmi_category ? t(bmiCategoryKey(data.bmi_category)) : undefined}
      />
      <MetricCard
        label={t('weight.cartouche.waist')}
        value={orDash(data.waist, kg1)}
        unit="cm"
        note={vsPrev(data.waist_delta)}
      />
      <MetricCard
        label={t('weight.cartouche.gap')}
        value={data.gap_to_goal === null ? DASH : signed1(data.gap_to_goal)}
        unit="kg"
      />
      <MetricCard
        label={t('weight.cartouche.projection')}
        value={proj.date ?? t(proj.key)}
        note={proj.date ? t('weight.projection.estimate') : undefined}
      />
    </div>
  );
}
