import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Chip } from '../../../components/Form/Chip';
import type { SourceFilter } from '../sourceFilter';
import styles from '../foods.module.css';

// Filters popover (specifications/screens/food-db.md): minimum-rating chips,
// visibility chips, source chips, show-archived toggle. min-rating 0 = "Toutes" (no filter);
// ≥1 excludes both Bof(0) and unrated.
export type MinRating = 0 | 1 | 2 | 3;
export type VisibilityFilter = 'all' | 'private' | 'shared';

interface FiltersPopoverProps {
  minRating: MinRating;
  visibility: VisibilityFilter;
  source: SourceFilter;
  /** Chips to offer; empty means the Source block is not rendered at all (B-295). */
  sourceOptions: SourceFilter[];
  showArchived: boolean;
  onMinRating: (r: MinRating) => void;
  onVisibility: (v: VisibilityFilter) => void;
  onSource: (s: SourceFilter) => void;
  onShowArchived: (v: boolean) => void;
}

export function FiltersPopover(props: FiltersPopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [open]);

  const ratings: MinRating[] = [0, 1, 2, 3];
  const visibilities: VisibilityFilter[] = ['all', 'private', 'shared'];

  return (
    <div className={styles.filterAnchor} ref={ref}>
      <button
        type="button"
        className={`${styles.filterbtn} ${open ? styles.on : ''}`}
        onClick={() => setOpen((v) => !v)}
      >
        ⚙ {t('foods.filters.title')}
      </button>
      {open && (
        <div className={styles.filterpop}>
          <h4>{t('foods.filters.minRating')}</h4>
          <div className={styles.chipRow}>
            {ratings.map((r) => (
              <Chip key={r} pressed={props.minRating === r} onClick={() => props.onMinRating(r)}>
                {r === 0 ? t('foods.filters.all') : `≥${r}★`}
              </Chip>
            ))}
          </div>
          <h4>{t('foods.filters.visibility')}</h4>
          <div className={styles.chipRow}>
            {visibilities.map((v) => (
              <Chip key={v} pressed={props.visibility === v} onClick={() => props.onVisibility(v)}>
                {t(`foods.visibility.${v}`)}
              </Chip>
            ))}
          </div>
          {props.sourceOptions.length > 0 && (
            <>
              <h4>{t('foods.filters.source')}</h4>
              <div className={styles.chipRow}>
                {props.sourceOptions.map((s) => (
                  <Chip key={s} pressed={props.source === s} onClick={() => props.onSource(s)}>
                    {t(`foods.source.${s}`)}
                  </Chip>
                ))}
              </div>
            </>
          )}
          <label className={styles.archivedToggle}>
            <input
              type="checkbox"
              checked={props.showArchived}
              onChange={(e) => props.onShowArchived(e.target.checked)}
            />
            {t('foods.filters.showArchived')}
          </label>
        </div>
      )}
    </div>
  );
}
