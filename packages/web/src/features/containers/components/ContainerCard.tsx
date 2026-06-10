import { useTranslation } from 'react-i18next';
import type { Container } from '@macronome/shared';
import styles from '../containers-mobile.module.css';

// One container card for the mobile list (mobile-responsive follow-up, mirrors FoodCard).
// Name + empty weight; the built-in "Rien" is non-tappable (badged + locked, like the desktop
// row). An editable card is a button that opens the edit sheet; delete is reached in that
// sheet's footer (mirrors the food/recipe pattern — no per-card delete control).
export function ContainerCard({
  container,
  onOpen,
}: {
  container: Container;
  onOpen: (c: Container) => void;
}) {
  const { t } = useTranslation();
  const weight = `${container.empty_weight_g} g`;

  if (container.is_builtin) {
    return (
      <div className={`${styles.card} ${styles.builtin}`}>
        <span className={styles.left}>
          <span className={styles.name}>{container.name}</span>
          <span className={styles.tag}>{t('containers.builtin')}</span>
        </span>
        <span className={styles.right}>
          <span className={styles.weight}>{weight}</span>
          <span className={styles.locked}>{t('containers.locked')}</span>
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`${styles.card} ${styles.tappable}`}
      data-container={container.id}
      aria-label={container.name}
      onClick={() => onOpen(container)}
    >
      <span className={styles.left}>
        <span className={styles.name}>{container.name}</span>
      </span>
      <span className={styles.weight}>{weight}</span>
    </button>
  );
}
