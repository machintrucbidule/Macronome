import styles from './states.module.css';

// Skeleton placeholder rows shown while a list loads (design/components/states.md).
export function SkeletonRows({ count = 6 }: { count?: number }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={styles.skeletonRow} />
      ))}
    </div>
  );
}
