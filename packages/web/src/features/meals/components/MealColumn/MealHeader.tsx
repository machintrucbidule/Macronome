import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useIsMobile } from '../../../../lib/useIsMobile';
import { CookModeButton } from './CookModeButton';
import { CopyMealButton } from './CopyMealButton';
import { MealMenuDropdown } from './MealMenuDropdown';
import { MealMenuSheet } from './MealMenuSheet';
import styles from './meal-column.module.css';

// Meal column header: name + the cook-mode button + the copy-yesterday button + the ⋯ menu
// (rename / move / delete — this day's slot only, never the template). Cook leads the pair
// (ICON-1/B-281): it is the frequently-used control. On mobile (S9, owner 2026-06-11) both
// buttons are hidden (CSS) and the ⋯ opens a bottom sheet instead of the dropdown, carrying the
// copy action as a text row; desktop keeps the exact dropdown. The ⊟ Restes button stays in the
// meal footer on mobile (owner correction 2026-06-11).
interface MealHeaderProps {
  name: string;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  /** Bulk actions of the ⋯ menu (MC-1/B-296) — disabled when they would change nothing. */
  canClearLines: boolean;
  canZeroLines: boolean;
  onCook: () => void;
  /** Copier le repas de la veille (CP-2/B-248) — header button on desktop, ⋯ sheet row on mobile. */
  onCopyYesterday: () => void;
  onClearLines: () => void;
  onZeroLines: () => void;
  onRename: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onDelete: () => void;
  /** Mobile-only extra control in the button row (the 📷+ one-tap photo entry, QP-1/B-158). It sits
   *  in the cook-button slot, which is CSS-hidden ≤560px; null on desktop / when the AI task is
   *  unconfigured. */
  extra?: ReactNode;
}

export function MealHeader({
  name,
  canMoveLeft,
  canMoveRight,
  canClearLines,
  canZeroLines,
  onCook,
  onCopyYesterday,
  onClearLines,
  onZeroLines,
  onRename,
  onMoveLeft,
  onMoveRight,
  onDelete,
  extra,
}: MealHeaderProps) {
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
      <CookModeButton onClick={onCook} />
      <CopyMealButton onClick={onCopyYesterday} />
      <div className={styles.menuWrap} ref={ref}>
        <button type="button" className={styles.menuBtn} onClick={() => setOpen((o) => !o)}>
          ⋯
        </button>
        {open && !isMobile && (
          <MealMenuDropdown
            canMoveLeft={canMoveLeft}
            canMoveRight={canMoveRight}
            canClearLines={canClearLines}
            canZeroLines={canZeroLines}
            onClearLines={act(onClearLines)}
            onZeroLines={act(onZeroLines)}
            onRename={act(onRename)}
            onMoveLeft={act(onMoveLeft)}
            onMoveRight={act(onMoveRight)}
            onDelete={act(onDelete)}
          />
        )}
      </div>
      {open && isMobile && (
        <MealMenuSheet
          name={name}
          canMoveLeft={canMoveLeft}
          canMoveRight={canMoveRight}
          canClearLines={canClearLines}
          canZeroLines={canZeroLines}
          onCopyYesterday={onCopyYesterday}
          onClearLines={onClearLines}
          onZeroLines={onZeroLines}
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
