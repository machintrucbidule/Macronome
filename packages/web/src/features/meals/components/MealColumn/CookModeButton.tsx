import { useTranslation } from 'react-i18next';
import styles from './meal-column.module.css';

// Cook-mode header button (ICON-1 / B-283): the **first** control after the meal name, ahead of
// the copy button (B-281) — cook mode is the frequently-used one of the pair.
//
// The icon is a numeric keypad — the keys themselves, 3×4 with the wide bottom-left one — drawn as
// an inline <svg>, not the former 🍳 emoji. Two reasons:
// at --fs-14 the emoji is an unrecognisable coloured blob that renders differently on every
// machine (the owner read it as a magnifier), and it named the *kitchen* rather than what the
// mode actually shows — a large touch NumPad (modals.md §Cook mode). Inlined at the call site —
// there is no shared Icon primitive, deliberately (top-nav.md) — and tinted via `currentColor`,
// which is --accent at rest so this is the findable control of the two. (The precedent used to be
// the Conseils appbar lightbulb; B-311 removed it when Conseils became a primary nav entry.)
export function CookModeButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className={styles.cookBtn}
      title={t('meals.cook.open')}
      aria-label={t('meals.cook.open')}
      onClick={onClick}
    >
      {/* The keys themselves — 3 columns × 4 rows of rounded keys with the wide one bottom-left,
          the shape of a real numeric keypad. No outer frame: a frame around two columns of dots
          read as a TV remote, not a keypad (owner, first look). Filled rather than outlined —
          at this size an outlined key is mostly stroke, and the reference is solid keys.
          18px inside the button's pinned 24px inner box; the icon no longer sets the height. */}
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
        <rect x="3" y="3" width="5" height="3.4" rx="1" />
        <rect x="9.5" y="3" width="5" height="3.4" rx="1" />
        <rect x="16" y="3" width="5" height="3.4" rx="1" />
        <rect x="3" y="7.8" width="5" height="3.4" rx="1" />
        <rect x="9.5" y="7.8" width="5" height="3.4" rx="1" />
        <rect x="16" y="7.8" width="5" height="3.4" rx="1" />
        <rect x="3" y="12.6" width="5" height="3.4" rx="1" />
        <rect x="9.5" y="12.6" width="5" height="3.4" rx="1" />
        <rect x="16" y="12.6" width="5" height="3.4" rx="1" />
        {/* The wide "0" key spanning the first two columns, and the last key beside it. */}
        <rect x="3" y="17.4" width="11.5" height="3.4" rx="1" />
        <rect x="16" y="17.4" width="5" height="3.4" rx="1" />
      </svg>
    </button>
  );
}
