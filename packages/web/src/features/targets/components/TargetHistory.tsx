import { useTranslation } from 'react-i18next';
import type { TargetVersion } from '@macronome/shared';
import { tableStyles } from '../../../components/DataTable/SortableTh';
import { kcal, ratio2, shortDate } from '../format';
import styles from '../targets.module.css';

// "Historique des cibles" (TH-1 / B-091): one row per target version, newest first, with
// its period (Depuis · Jusqu'au) and values. Clicking a row loads it into the left form
// for editing; the × removes it (confirmed). The active row (being edited) is highlighted.
interface TargetHistoryProps {
  versions: TargetVersion[];
  activeId: string | null;
  onSelect: (v: TargetVersion) => void;
  onDelete: (v: TargetVersion) => void;
}

export function TargetHistory({ versions, activeId, onSelect, onDelete }: TargetHistoryProps) {
  const { t, i18n } = useTranslation();
  return (
    <section className={styles.history}>
      <header className={styles.historyHead}>
        <h2>{t('targets.history.title')}</h2>
      </header>
      <div className={tableStyles.wrap}>
        <table className={tableStyles.table}>
          <thead>
            <tr>
              <th>{t('targets.history.from')}</th>
              <th>{t('targets.history.until')}</th>
              <th className={tableStyles.r}>{t('targets.history.calories')}</th>
              <th className={tableStyles.r}>{t('targets.history.ratios')}</th>
              <th aria-label="actions" />
            </tr>
          </thead>
          <tbody>
            {versions.map((v) => (
              <tr
                key={v.id}
                className={`${tableStyles.clickable} ${v.id === activeId ? styles.activeRow : ''}`}
                onClick={() => onSelect(v)}
              >
                <td>{shortDate(v.effective_from, i18n.language)}</td>
                <td>
                  {v.until ? shortDate(v.until, i18n.language) : t('targets.history.current')}
                </td>
                <td className={tableStyles.num}>
                  {kcal(v.calorie_min)}–{kcal(v.calorie_max)}
                </td>
                <td className={tableStyles.num}>
                  {ratio2(v.protein_g_per_kg)} / {ratio2(v.fat_g_per_kg)}
                </td>
                <td>
                  <button
                    type="button"
                    className={styles.iconbtn}
                    title={t('targets.history.delete')}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(v);
                    }}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
