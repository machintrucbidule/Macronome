import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/Button/Button';
import { SearchField } from '../../../components/Form/SearchField';
import { FiltersPopover, type MinRating } from './FiltersPopover';
import styles from '../recipes.module.css';

// Recettes toolbar: title + count, search field, filters popover, "+ Ajouter une recette"
// CTA (specifications/screens/recipe.md). Mirrors the Foods / Daily-log toolbar.
interface RecipesToolbarProps {
  /** Rows matching the current filters, server-side (B-279). Undefined before page 1: the
   *  chip stays empty rather than showing a number that would immediately change. */
  count: number | undefined;
  q: string;
  minRating: MinRating;
  showArchived: boolean;
  onQ: (q: string) => void;
  onMinRating: (r: MinRating) => void;
  onShowArchived: (v: boolean) => void;
  onAdd: () => void;
  /** Batch-edit control + count (BE-1/B-308), rendered left of the filters like Aliments. */
  bulk?: ReactNode;
}

export function RecipesToolbar(props: RecipesToolbarProps) {
  const { t } = useTranslation();
  return (
    <div className={styles.toolbar}>
      <h1>{t('recipes.title')}</h1>
      <span className={styles.count}>
        {props.count === undefined ? '' : t('recipes.count', { count: props.count })}
      </span>
      <SearchField
        value={props.q}
        placeholder={t('recipes.searchPlaceholder')}
        onChange={(e) => props.onQ(e.target.value)}
      />
      {props.bulk}
      <FiltersPopover
        minRating={props.minRating}
        showArchived={props.showArchived}
        onMinRating={props.onMinRating}
        onShowArchived={props.onShowArchived}
      />
      <Button className={styles.addbtn} onClick={props.onAdd}>
        {t('recipes.add')}
      </Button>
    </div>
  );
}
