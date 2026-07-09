import { useTranslation } from 'react-i18next';
import type { TargetVersion } from '@macronome/shared';
import styles from '../advices.module.css';

// Read-only target-band history for the advices dashboard (B-202). A compact table (current band =
// the row with `until: null`) — NOT the Cibles editor table, since this recap has no edit/delete.
export function AdviceTargetHistory({ versions }: { versions: TargetVersion[] }) {
  const { t } = useTranslation();
  if (versions.length === 0) return <p className={styles.empty}>{t('advices.noTarget')}</p>;
  return (
    <table className={styles.thistory}>
      <thead>
        <tr>
          <th>{t('advices.th.from')}</th>
          <th>{t('advices.th.band')}</th>
          <th>{t('advices.th.protein')}</th>
          <th>{t('advices.th.fat')}</th>
        </tr>
      </thead>
      <tbody>
        {versions.map((v) => (
          <tr key={v.id}>
            <td>
              {v.effective_from}
              {v.until ? ` → ${v.until}` : ''}
            </td>
            <td className="num">
              {v.calorie_min}–{v.calorie_max}
            </td>
            <td className="num">{v.protein_g_per_kg}</td>
            <td className="num">{v.fat_g_per_kg}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
