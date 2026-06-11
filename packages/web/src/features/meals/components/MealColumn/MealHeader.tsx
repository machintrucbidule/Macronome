import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../../../../lib/useIsMobile';
import { MealMenuSheet } from './MealMenuSheet';
import styles from './meal-column.module.css';

// Meal column header: the 🍳 cook-mode button, name + the ⋯ menu (rename / move / delete — this
// day's slot only, never the template). On mobile (S9, owner 2026-06-11) the 🍳 button is hidden
// (CSS) and the ⋯ opens a bottom sheet instead of the dropdown; desktop keeps the exact dropdown +
// 🍳. The ⊟ Restes button stays in the meal footer on mobile (owner correction 2026-06-11).
interface MealHeaderProps {
  name: string;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  onCook: () => void;
  onRename: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onDelete: () => void;
  /** Mobile-only extra control in the button row (the 📷+ one-tap photo entry, QP-1/B-158). It sits
   *  in the 🍳 slot, which is CSS-hidden ≤560px; null on desktop / when the AI task is unconfigured. */
  extra?: ReactNode;
}

export function MealHeader({
  name,
  canMoveLeft,
  canMoveRight,
  onCook,
  onRename,
  onMoveLeft,
  onMoveRight,
  onDelete,
  extra,
}: MealHeaderProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Click-outside closes the desktop dropdown; the mobile sheet manages its own scrim close.
  useEffect(() => {
    if (!open || isMobile) return;
    const onDoc = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, isMobile]);

  const act = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <div className={styles.head}>
      <span className={styles.name}>{name}</span>
      {extra}
      <button
        type="button"
        className={styles.cookBtn}
        title={t('meals.cook.open')}
        aria-label={t('meals.cook.open')}
        onClick={onCook}
      >
        🍳
      </button>
      <div className={styles.menuWrap} ref={ref}>
        <button type="button" className={styles.menuBtn} onClick={() => setOpen((o) => !o)}>
          ⋯
        </button>
        {open && !isMobile && (
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
      {open && isMobile && (
        <MealMenuSheet
          name={name}
          canMoveLeft={canMoveLeft}
          canMoveRight={canMoveRight}
          onRename={onRename}
          onMoveLeft={onMoveLeft}
          onMoveRight={onMoveRight}
          onDelete={onDelete}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
