import { useTranslation } from 'react-i18next';
import { AppShell } from '../../app/AppShell';
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
export function WeightPage() {
  const { t } = useTranslation();
  const ctl = useWeightController();
  const query = useWeight(ctl.range);
  const serverMode = query.data?.current_mode ?? null;
  const { mode, setMode } = useWeightMode(serverMode);
  const csv = useCsvExport(dataApi.exportWeightCsv);
  const isMobile = useIsMobile();

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
    <AppShell>
      {csv.error && (
        <div className={styles.errorBar}>
          <Banner tone="warning" onDismiss={csv.dismiss}>
            {t('weight.exportError')}
          </Banner>
        </div>
      )}
      {isMobile ? <WeightMobile {...common} /> : <WeightDesktop {...common} />}
      {ctl.modal && (
        <WeighInModal target={ctl.modal} defaultFlag={mode ?? 'in_diet'} onClose={ctl.closeModal} />
      )}
    </AppShell>
  );
}
