import styles from './Fab.module.css';

// Mobile-only floating "+" action button (mobile-responsive S3, spec §2.3;
// design/components/bottom-nav.md). Created here but PLACED BY EACH SCREEN — wired in S6
// (Recettes) / S7 (Aliments) / S8 (Poids) and on Contenants with its own mobile slice. The rule
// for who gets one is structural (B-328): a phone layout that is a card list whose main action is
// "add one" — not a list of primary screens. `fab-screens.test.ts` holds the four to it. It is
// `display:none` ≥561px (absent from the desktop layout + tab tree), sits bottom-right above
// the bottom tab bar, and opens that screen's bottom-sheet add form.
export function Fab({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" className={styles.fab} aria-label={label} onClick={onClick}>
      +
    </button>
  );
}
