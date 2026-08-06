import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SelectMenu } from '../../../components/SelectMenu/SelectMenu';
import styles from '../foods.module.css';

// Filters popover of the Catalogue Ciqual mode (B-292). One control: the food group. It is a
// dropdown rather than the chip rows the library filters use — twelve group labels, several of
// them long ("fruits, légumes, légumineuses et oléagineux"), would fill the 240px popover with
// a dozen wrapped lines (owner decision).
interface CatalogFiltersProps {
  group: string;
  groups: string[];
  onGroup: (group: string) => void;
}

export function CatalogFilters(props: CatalogFiltersProps) {
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

  const options = [
    { value: '', label: t('foods.catalog.allGroups') },
    ...props.groups.map((g) => ({ value: g, label: g })),
  ];

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
          <h4>{t('foods.filters.group')}</h4>
          <SelectMenu
            value={props.group}
            options={options}
            onChange={props.onGroup}
            variant="field"
            ariaLabel={t('foods.filters.group')}
          />
        </div>
      )}
    </div>
  );
}
