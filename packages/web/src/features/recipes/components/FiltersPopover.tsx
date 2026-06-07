import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Chip } from '../../../components/Form/Chip';
import styles from '../recipes.module.css';

// Recipes filters popover (specifications/screens/recipe.md): minimum-rating chips +
// show-archived toggle. Mirrors the Aliments popover, minus the visibility row (recipes
// are always owner-scoped). min-rating 0 = "Toutes" (no filter); ≥1 excludes both Bof(0)
// and unrated (B-080/B-081, RT-1).
export type MinRating = 0 | 1 | 2 | 3;

interface FiltersPopoverProps {
  minRating: MinRating;
  showArchived: boolean;
  onMinRating: (r: MinRating) => void;
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

  return (
    <div className={styles.filterAnchor} ref={ref}>
      <button
        type="button"
        className={`${styles.filterbtn} ${open ? styles.on : ''}`}
        onClick={() => setOpen((v) => !v)}
      >
        ⚙ {t('recipes.filters.title')}
      </button>
      {open && (
        <div className={styles.filterpop}>
          <h4>{t('recipes.filters.minRating')}</h4>
          <div className={styles.chipRow}>
            {ratings.map((r) => (
              <Chip key={r} pressed={props.minRating === r} onClick={() => props.onMinRating(r)}>
                {r === 0 ? t('recipes.filters.all') : `≥${r}★`}
              </Chip>
            ))}
          </div>
          <label className={styles.archivedToggle}>
            <input
              type="checkbox"
              checked={props.showArchived}
              onChange={(e) => props.onShowArchived(e.target.checked)}
            />
            {t('recipes.filters.showArchived')}
          </label>
        </div>
      )}
    </div>
  );
}
