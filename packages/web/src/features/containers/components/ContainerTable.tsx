import { useTranslation } from 'react-i18next';
import type { Container } from '@macronome/shared';
import styles from '../containers.module.css';

// Container table (screens/containers.md): sortable Nom · Poids à vide; the locked built-in
// "Rien" always shows first (badged, no actions); other rows are click-to-edit + delete (×).
export type SortKey = 'name' | 'weight';

interface Props {
  rows: Container[];
  sort: SortKey;
  dir: 'asc' | 'desc';
  onSort: (key: SortKey) => void;
  onEdit: (c: Container) => void;
  onDelete: (c: Container) => void;
}

export function ContainerTable({ rows, sort, dir, onSort, onEdit, onDelete }: Props) {
  const { t } = useTranslation();
  const arrow = (k: SortKey): string => (sort === k ? (dir === 'asc' ? ' ↑' : ' ↓') : '');
  return (
    <div className={styles.card}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th onClick={() => onSort('name')}>
              {t('containers.col.name')}
              {arrow('name')}
            </th>
            <th className={styles.r} onClick={() => onSort('weight')}>
              {t('containers.col.weight')}
              {arrow('weight')}
            </th>
            <th className={styles.r} aria-hidden />
          </tr>
        </thead>
        <tbody>
          {rows.map((c) =>
            c.is_builtin ? (
              <tr key={c.id}>
                <td>
                  {c.name}
                  <span className={styles.badge}>{t('containers.builtin')}</span>
                </td>
                <td className={`${styles.r} ${styles.num}`}>{c.empty_weight_g} g</td>
                <td className={styles.a}>
                  <span className={styles.locked}>{t('containers.locked')}</span>
                </td>
              </tr>
            ) : (
              <tr
                key={c.id}
                className={styles.clickable}
                onClick={() => onEdit(c)}
                aria-label={c.name}
              >
                <td>{c.name}</td>
                <td className={`${styles.r} ${styles.num}`}>{c.empty_weight_g} g</td>
                <td className={styles.a}>
                  <button
                    type="button"
                    className={styles.del}
                    title={t('common.remove')}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(c);
                    }}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}
