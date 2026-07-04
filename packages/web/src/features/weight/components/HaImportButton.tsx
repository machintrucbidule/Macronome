import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { HaWeightResponse } from '@macronome/shared';
import { ApiError } from '../../../api/client';
import { integrationsApi } from '../../../api/integrations';
import { formatMeasuredAt } from '../../integrations/format';
import { useSettingsQuery } from '../../settings/useSettings';
import styles from '../weight.module.css';

// "Importer depuis HA" (B-180, specifications/screens/weight.md): add-mode only, rendered
// only when the Home Assistant integration is configured. Fills the WEIGHT field with the
// server-rounded measurement, shows the measurement datetime, and warns (non-blocking)
// when the measurement date ≠ the modal's date. Never touches the modal's date field.
const KNOWN_HA_ERRORS = new Set([
  'ha_not_configured',
  'ha_unauthorized',
  'ha_entity_not_found',
  'ha_no_measurement',
  'ha_unavailable',
  'ha_unreachable',
  'ha_bad_response',
]);

interface HaImportButtonProps {
  /** The modal's selected date (YYYY-MM-DD) — read for the mismatch hint only. */
  date: string;
  onWeight: (weightKg: number) => void;
}

/** Post-import hints: measurement datetime, date-mismatch warning, mapped error. */
function ImportFeedback(props: { result: HaWeightResponse | null; date: string; error: unknown }) {
  const { t, i18n } = useTranslation();
  const { result, date, error } = props;
  if (result) {
    const mismatch = result.measured_at.slice(0, 10) !== date;
    return (
      <>
        <p className={styles.haImportNote}>
          {t('weight.haImport.measuredAt', {
            date: formatMeasuredAt(result.measured_at, i18n.language),
          })}
        </p>
        {mismatch && <p className={styles.haImportWarn}>{t('weight.haImport.dateMismatch')}</p>}
      </>
    );
  }
  if (!error) return null;
  const code = error instanceof ApiError && KNOWN_HA_ERRORS.has(error.code) ? error.code : null;
  return (
    <p className={styles.haImportWarn}>
      {code ? t(`integrations.errors.${code}`) : t('weight.haImport.error')}
    </p>
  );
}

export function HaImportButton({ date, onWeight }: HaImportButtonProps) {
  const { t } = useTranslation();
  const ha = useSettingsQuery().data?.data.integrations.home_assistant ?? null;
  const imp = useMutation({
    mutationFn: () => integrationsApi.fetchHaWeight(),
    onSuccess: (res) => onWeight(res.data.weight_kg),
  });

  if (!ha) return null;

  return (
    <div className={styles.haImport}>
      <button
        type="button"
        className={styles.haImportBtn}
        disabled={imp.isPending}
        onClick={() => imp.mutate()}
      >
        {imp.isPending ? t('weight.haImport.importing') : t('weight.haImport.button')}
      </button>
      <ImportFeedback result={imp.data?.data ?? null} date={date} error={imp.error} />
    </div>
  );
}
