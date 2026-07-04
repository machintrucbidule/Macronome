import { useTranslation } from 'react-i18next';
import { TextInput } from '../../../components/Form/TextInput';
import { formatMeasuredAt } from '../format';
import { useHaForm } from '../useHaForm';
import { ConnectionActions } from './ConnectionActions';
import styles from '../integrations.module.css';

// Home Assistant card (specifications/screens/integrations.md §Card 1): base URL,
// write-only long-lived token, user-supplied weight entity id (never defaulted),
// rounding decimals. "Tester" persists then runs the weight read (the connection proof).
const DECIMALS = [0, 1, 2, 3];

export function HomeAssistantCard() {
  const { t, i18n } = useTranslation();
  const f = useHaForm();

  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>{t('integrations.ha.title')}</div>
      <div className={styles.body}>
        <TextInput
          label={t('integrations.baseUrl')}
          value={f.baseUrl}
          invalid={f.baseUrlInvalid}
          placeholder={t('integrations.ha.baseUrlPlaceholder')}
          onChange={(e) => f.setBaseUrl(e.target.value)}
        />
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t('integrations.ha.token')}</span>
          <TextInput
            type="password"
            value={f.token}
            placeholder={
              f.tokenSet && !f.tokenDirty
                ? t('integrations.secretSet')
                : t('integrations.ha.tokenPlaceholder')
            }
            onChange={(e) => f.setTokenValue(e.target.value)}
          />
        </label>
        <TextInput
          label={t('integrations.ha.entityId')}
          value={f.entityId}
          invalid={f.entityIdInvalid}
          placeholder={t('integrations.ha.entityIdPlaceholder')}
          onChange={(e) => f.setEntityId(e.target.value)}
        />
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t('integrations.ha.decimals')}</span>
          <select
            className={styles.select}
            value={f.decimals}
            onChange={(e) => f.setDecimals(Number(e.target.value))}
          >
            {DECIMALS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>

        <details className={styles.help}>
          <summary>{t('integrations.ha.helpTitle')}</summary>
          <ol>
            <li>{t('integrations.ha.help1')}</li>
            <li>{t('integrations.ha.help2')}</li>
            <li>{t('integrations.ha.help3')}</li>
            <li>{t('integrations.ha.help4')}</li>
          </ol>
        </details>

        <ConnectionActions
          f={f}
          testNote={
            f.testResult &&
            t('integrations.ha.testOk', {
              weight: f.testResult.weight_kg,
              date: formatMeasuredAt(f.testResult.measured_at, i18n.language),
            })
          }
        />
      </div>
    </div>
  );
}
