import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/Button/Button';
import { SearchField } from '../../../components/Form/SearchField';
import styles from '../recipes.module.css';

// Recettes toolbar: title + count, search field, "+ Ajouter une recette" CTA
// (specifications/screens/recipe.md). Mirrors the Foods / Daily-log toolbar.
interface RecipesToolbarProps {
  count: number;
  q: string;
  onQ: (q: string) => void;
  onAdd: () => void;
}

export function RecipesToolbar({ count, q, onQ, onAdd }: RecipesToolbarProps) {
  const { t } = useTranslation();
  return (
    <div className={styles.toolbar}>
      <h1>{t('recipes.title')}</h1>
      <span className={styles.count}>{t('recipes.count', { count })}</span>
      <SearchField
        value={q}
        placeholder={t('recipes.searchPlaceholder')}
        onChange={(e) => onQ(e.target.value)}
      />
      <Button className={styles.addbtn} onClick={onAdd}>
        {t('recipes.add')}
      </Button>
    </div>
  );
}
