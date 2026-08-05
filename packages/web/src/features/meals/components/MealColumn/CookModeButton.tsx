import { useTranslation } from 'react-i18next';
import styles from './meal-column.module.css';

// Cook-mode header button (ICON-1 / B-283): the **first** control after the meal name, ahead of
// the copy button (B-281) — cook mode is the frequently-used one of the pair.
//
// The icon is a numeric keypad drawn as an inline <svg>, not the former 🍳 emoji. Two reasons:
// at --fs-14 the emoji is an unrecognisable coloured blob that renders differently on every
// machine (the owner read it as a magnifier), and it named the *kitchen* rather than what the
// mode actually shows — a large touch NumPad (modals.md §Cook mode). Same precedent as the
// Conseils lightbulb (app/AppShell.tsx): inlined at the call site — there is no shared Icon
// primitive, deliberately (top-nav.md) — and tinted via `currentColor`, which is --accent at rest
// so this is the findable control of the two.
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
      {/* Outline style (fill:none + stroke), matching SearchField / BottomNav / ListChrome: a
          keypad grid reads better outlined than filled at this size. 18px like the lightbulb. */}
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        aria-hidden="true"
      >
        <rect x="4" y="3" width="16" height="18" rx="2.5" />
        <circle cx="9" cy="8" r="1.1" fill="currentColor" stroke="none" />
        <circle cx="15" cy="8" r="1.1" fill="currentColor" stroke="none" />
        <circle cx="9" cy="12.5" r="1.1" fill="currentColor" stroke="none" />
        <circle cx="15" cy="12.5" r="1.1" fill="currentColor" stroke="none" />
        <circle cx="9" cy="17" r="1.1" fill="currentColor" stroke="none" />
        <circle cx="15" cy="17" r="1.1" fill="currentColor" stroke="none" />
      </svg>
    </button>
  );
}
