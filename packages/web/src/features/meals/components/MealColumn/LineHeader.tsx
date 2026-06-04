import { useTranslation } from 'react-i18next';
import lineStyles from '../FoodLine/food-line.module.css';

// Column sub-header: Aliment / Qté / kcal / L / G / P (matches the line grid columns).
export function LineHeader() {
  const { t } = useTranslation();
  return (
    <div className={lineStyles.lhead}>
      <span />
      <span>{t('meals.col.food')}</span>
      <span className={lineStyles.r}>{t('meals.col.qty')}</span>
      <span className={lineStyles.r}>{t('meals.col.kcal')}</span>
      <span className={lineStyles.r}>{t('meals.col.fat')}</span>
      <span className={lineStyles.r}>{t('meals.col.carb')}</span>
      <span className={lineStyles.r}>{t('meals.col.protein')}</span>
      <span />
      <span />
    </div>
  );
}
