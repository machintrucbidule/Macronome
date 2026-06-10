import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { DietFlag, GetWeightResponse } from '@macronome/shared';
import { EmptyState } from '../../../components/states/EmptyState';
import { SkeletonRows } from '../../../components/states/SkeletonRows';
import { ListToolbar, OverflowMenu } from '../../../components/ListChrome';
import { Fab } from '../../../app/Fab';
import { FlagToggle } from './FlagToggle';
import { PeriodList } from './PeriodList';
import { PeriodDetailSheet } from './PeriodDetailSheet';
import { WeightOverview } from './WeightOverview';
import type { WeightController } from '../useWeightController';
import wstyles from '../weight.module.css';

// Mobile Poids view (mobile-responsive S8, spec §6 + mockups/04-weight.html). A sticky controls
// row (Régime/Maintien + "⋯" export — the chart keeps its own range/waist controls, owner
// decision 2026-06-10), the full-width cartouche + chart overview, and the compact period list
// replacing the 15-column table; tapping a period opens a detail sheet with all 15 figures, and a
// FAB adds a weigh-in. The screen title is the app bar's (S3), so no page <h1> here. Consumes the
// shared ListChrome/Fab read-only; renders only (rule 2) — desktop is untouched (never mounts ≥561px).
interface WeightMobileProps {
  data: GetWeightResponse | undefined;
  loading: boolean;
  empty: boolean;
  ctl: WeightController;
  mode: DietFlag | null;
  onMode: (m: DietFlag) => void;
  onExport: () => void;
}

export function WeightMobile(props: WeightMobileProps) {
  const { data, loading, empty, ctl, mode, onMode, onExport } = props;
  const { t } = useTranslation();
  const [detailDate, setDetailDate] = useState<string | null>(null);

  const byDate = data ? new Map(data.weigh_ins.map((w) => [w.date, w])) : null;
  // Resolve the open period from the live data so an edit-refetch keeps the sheet in sync.
  const detailPeriod =
    detailDate && data ? (data.periods.find((p) => p.end_date === detailDate) ?? null) : null;

  const body = ((): ReactNode => {
    if (loading) return <SkeletonRows />;
    if (!data || empty) return <EmptyState>{t('weight.empty')}</EmptyState>;
    return (
      <div className={wstyles.layout}>
        <WeightOverview data={data} ctl={ctl} />
        {data.periods.length > 0 ? (
          <PeriodList periods={data.periods} onOpen={(p) => setDetailDate(p.end_date)} />
        ) : (
          <EmptyState>{t('weight.single')}</EmptyState>
        )}
      </div>
    );
  })();

  return (
    <>
      <ListToolbar
        leading={
          mode ? (
            <span className={wstyles.modeLabel}>
              {t('weight.mode.label')}
              <FlagToggle value={mode} onChange={onMode} />
            </span>
          ) : undefined
        }
      >
        <OverflowMenu actions={[{ label: t('weight.exportCsv'), onClick: onExport }]} />
      </ListToolbar>

      {body}

      <Fab onClick={ctl.openAdd} label={t('weight.add')} />

      {detailPeriod && (
        <PeriodDetailSheet
          period={detailPeriod}
          onClose={() => setDetailDate(null)}
          onEdit={() => {
            const w = byDate?.get(detailPeriod.end_date);
            setDetailDate(null);
            if (w) ctl.openEdit(w);
          }}
        />
      )}
    </>
  );
}
