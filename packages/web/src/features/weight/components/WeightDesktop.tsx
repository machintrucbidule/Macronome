import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DietFlag, GetWeightResponse, WeighIn } from '@macronome/shared';
import { EmptyState } from '../../../components/states/EmptyState';
import { SkeletonTableRows } from '../../../components/states/SkeletonTableRows';
import { PeriodTable } from './PeriodTable';
import { WeightHeader } from './WeightHeader';
import { WeightOverview } from './WeightOverview';
import { WeighInDeleteConfirm } from './WeighInDeleteConfirm';
import { IntervalDaysModal } from './IntervalDaysModal';
import { useWeightContextMenu } from './useWeightContextMenu';
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
  // Context-menu "Supprimer la pesée" target (B-195): confirmed in a styled modal below.
  const [deleting, setDeleting] = useState<WeighIn | null>(null);
  useWeightContextMenu({ ctl, byDate, onDelete: setDeleting });
  return (
    <>
      <WeightHeader mode={mode} onMode={onMode} onAdd={ctl.openAdd} onExport={onExport} />
      {deleting && <WeighInDeleteConfirm weighIn={deleting} onClose={() => setDeleting(null)} />}
      {loading ? (
        <SkeletonTableRows />
      ) : !data || empty ? (
        <EmptyState>{t('weight.empty')}</EmptyState>
      ) : (
        <div className={styles.layout}>
          <WeightOverview data={data} ctl={ctl} />
          {data.periods.length > 0 || data.open_period ? (
            <PeriodTable
              periods={data.periods}
              openPeriod={data.open_period}
              onRowClick={(d) => {
                const w = byDate?.get(d);
                if (w) ctl.openEdit(w);
              }}
              onOpenClick={ctl.openOpenPeriod}
              onRecap={ctl.openRecap}
            />
          ) : (
            <EmptyState>{t('weight.single')}</EmptyState>
          )}
        </div>
      )}
      {ctl.recap && (
        <IntervalDaysModal
          start={ctl.recap.start}
          end={ctl.recap.end}
          weightEnd={ctl.recap.weightEnd}
          delta={ctl.recap.delta}
          onClose={ctl.closeRecap}
        />
      )}
    </>
  );
}
