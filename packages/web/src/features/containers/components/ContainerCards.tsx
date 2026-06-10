import type { Container } from '@macronome/shared';
import { ContainerCard } from './ContainerCard';
import styles from '../containers-mobile.module.css';

// Mobile container list (mobile-responsive follow-up): the phone replacement for the table,
// fed the same already-filtered/sorted Container[] (built-ins pinned first).
export function ContainerCards({
  containers,
  onOpen,
}: {
  containers: Container[];
  onOpen: (c: Container) => void;
}) {
  return (
    <div className={styles.cardList}>
      {containers.map((c) => (
        <ContainerCard key={c.id} container={c} onOpen={onOpen} />
      ))}
    </div>
  );
}
