import styles from './states.module.css';

// Skeleton placeholder rows shown while a list loads (design/components/states.md).
//
// B-272: the OUTER element carries `aria-busy` and stays in the accessibility tree, while the
// bars themselves remain `aria-hidden` — a screen reader must know the region is loading, but a
// row of decorative bars is not content. (`aria-busy` on an `aria-hidden` node would be ignored
// outright.) It is a state, not a live region: reported when the user reaches the region, never
// announced over what they are doing — the announcements are scoped to page arrivals instead.
export function SkeletonRows({ count = 6 }: { count?: number }) {
  return (
    <div aria-busy="true">
      <div aria-hidden="true">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className={styles.skeletonRow} />
        ))}
      </div>
    </div>
  );
}
