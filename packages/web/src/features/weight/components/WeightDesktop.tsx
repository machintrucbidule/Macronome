import { useTranslation } from 'react-i18next';
import type { DietFlag, GetWeightResponse } from '@macronome/shared';
import { EmptyState } from '../../../components/states/EmptyState';
import { SkeletonRows } from '../../../components/states/SkeletonRows';
import { PeriodTable } from './PeriodTable';
import { WeightHeader } from './WeightHeader';
import { WeightOverview } from './WeightOverview';
import type { WeightController } from '../useWeightController';
import styles from '../weight.module.css';

// Desktop Poids tree (mobile-responsive S8): the screen exactly as before the slice — the
// header (always shown), then the loading → empty → body switch; the body is the cartouche +
// chart overview + the 15-column PeriodTable whose row click opens the period's ending
// weigh-in. Rendered when useIsMobile() is false → byte-identical to the former WeightPage body.
interface WeightDesktopProps {
  data: GetWeightResponse | undefined;
  loading: boolean;
  empty: boolean;
  ctl: WeightController;
  mode: DietFlag | null;
  onMode: (m: DietFlag) => void;
  onExport: () => void;
}

export function WeightDesktop(props: WeightDesktopProps) {
  const { data, loading, empty, ctl, mode, onMode, onExport } = props;
  const { t } = useTranslation();
  const byDate = data ? new Map(data.weigh_ins.map((w) => [w.date, w])) : null;
  return (
    <>
      <WeightHeader mode={mode} onMode={onMode} onAdd={ctl.openAdd} onExport={onExport} />
      {loading ? (
        <SkeletonRows />
      ) : !data || empty ? (
        <EmptyState>{t('weight.empty')}</EmptyState>
      ) : (
        <div className={styles.layout}>
          <WeightOverview data={data} ctl={ctl} />
          {data.periods.length > 0 ? (
            <PeriodTable
              periods={data.periods}
              onRowClick={(d) => {
                const w = byDate?.get(d);
                if (w) ctl.openEdit(w);
              }}
            />
          ) : (
            <EmptyState>{t('weight.single')}</EmptyState>
          )}
        </div>
      )}
    </>
  );
}
