import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { GetWeightResponse, WeighIn } from '@macronome/shared';
import { dataApi } from '../../api/data';
import { Banner } from '../../components/Banner/Banner';
import { useCsvExport } from '../../lib/useCsvExport';
import { useIsMobile } from '../../lib/useIsMobile';
import { WeighInModal } from './components/WeighInModal';
import { WeightDesktop } from './components/WeightDesktop';
import { WeightMobile } from './components/WeightMobile';
import { useWeight } from './useWeight';
import { useWeightController } from './useWeightController';
import { useWeightMode } from './useWeightMode';
import styles from './weight.module.css';

// Poids screen (specifications/screens/weight.md): cartouche + chart + period table. Every
// figure is server-derived (rule 2); the screen renders, toggles the range/waist/mode, and edits
// weigh-ins through the modal. Mobile-responsive S8: a useIsMobile() render-switch picks the
// desktop tree (WeightDesktop — byte-identical to before) or the mobile tree (WeightMobile —
// controls row + list → detail sheet + FAB); the weigh-in modal is shared (bottom sheet ≤560px).
// The current mode is seeded from the server's persisted `current_mode` and persisted on change
// (M7), via useWeightMode.

// Most recent weigh-in (weigh_ins is ascending) — the add modal's weight/waist prefill (B-179).
const lastWeighInOf = (data: GetWeightResponse | undefined): WeighIn | null =>
  data?.weigh_ins.at(-1) ?? null;

export function WeightPage() {
  const { t } = useTranslation();
  const ctl = useWeightController();
  const query = useWeight(ctl.range);
  const serverMode = query.data?.current_mode ?? null;
  const { mode, setMode } = useWeightMode(serverMode);
  const csv = useCsvExport(dataApi.exportWeightCsv);
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();

  // App-shortcut deep link (B-183): `?action=add` opens the add-weigh-in sheet, then the
  // param is consumed (replace) so refresh/back never re-opens it.
  // Fire only on the ?action=add transition — NOT on every render. `ctl` is a new object each
  // render (useWeightController isn't memoized) and `setSearchParams` may be too; depending on
  // them would re-run on the close re-render and re-open the modal on Cancel (B-183 follow-up).
  const wantsAdd = searchParams.get('action') === 'add';
  useEffect(() => {
    if (!wantsAdd) return;
    ctl.openAdd();
    setSearchParams({}, { replace: true });
  }, [wantsAdd]);

  const empty = !!(query.data && query.data.cartouche.current === null);
  const common = {
    data: query.data,
    loading: query.isLoading,
    empty,
    ctl,
    mode,
    onMode: setMode,
    onExport: csv.start,
  };

  return (
    <>
      {csv.error && (
        <div className={styles.errorBar}>
          <Banner tone="warning" onDismiss={csv.dismiss}>
            {t('weight.exportError')}
          </Banner>
        </div>
      )}
      {isMobile ? <WeightMobile {...common} /> : <WeightDesktop {...common} />}
      {ctl.modal && (
        <WeighInModal
          target={ctl.modal}
          defaultFlag={mode ?? 'in_diet'}
          openNote={query.data?.open_period?.note ?? null}
          lastWeighIn={lastWeighInOf(query.data)}
          onRecap={() => {
            const op = query.data?.open_period;
            ctl.closeModal();
            if (op) ctl.openRecap(op);
          }}
          onClose={ctl.closeModal}
        />
      )}
    </>
  );
}
