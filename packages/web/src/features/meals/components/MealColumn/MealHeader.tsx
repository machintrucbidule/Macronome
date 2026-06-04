import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './meal-column.module.css';

// Meal column header: name + the ⋯ menu (rename / move / delete — this day's slot only, never
// the template). The 🍳 cook button is shown disabled; Cook mode ships in M9.
interface MealHeaderProps {
  name: string;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  onRename: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onDelete: () => void;
}

export function MealHeader({
  name,
  canMoveLeft,
  canMoveRight,
  onRename,
  onMoveLeft,
  onMoveRight,
  onDelete,
}: MealHeaderProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const act = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <div className={styles.head}>
      <span className={styles.name}>{name}</span>
      <button type="button" className={styles.cookBtn} disabled title={t('meals.cookSoon')}>
        🍳
      </button>
      <div className={styles.menuWrap} ref={ref}>
        <button type="button" className={styles.menuBtn} onClick={() => setOpen((o) => !o)}>
          ⋯
        </button>
        {open && (
          <div className={styles.popmenu} role="menu">
            <button type="button" onClick={act(onRename)}>
              {t('meals.meal.rename')}
            </button>
            <button type="button" disabled={!canMoveLeft} onClick={act(onMoveLeft)}>
              {t('meals.meal.moveLeft')}
            </button>
            <button type="button" disabled={!canMoveRight} onClick={act(onMoveRight)}>
              {t('meals.meal.moveRight')}
            </button>
            <button type="button" className={styles.danger} onClick={act(onDelete)}>
              {t('meals.meal.delete')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
