import styles from './Fab.module.css';

// Mobile-only floating "+" action button (mobile-responsive S3, spec §2.3;
// design/components/bottom-nav.md). Created here but PLACED BY EACH SCREEN — wired in S6
// (Recettes) / S7 (Aliments) / S8 (Poids), so AppShell is not touched again after S3. It is
// `display:none` ≥561px (absent from the desktop layout + tab tree), sits bottom-right above
// the bottom tab bar, and opens that screen's bottom-sheet add form.
export function Fab({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" className={styles.fab} aria-label={label} onClick={onClick}>
      +
    </button>
  );
}
