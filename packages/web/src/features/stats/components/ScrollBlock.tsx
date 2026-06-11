import { type ReactNode, useLayoutEffect, useRef } from 'react';
import { useIsMobile } from '../../../lib/useIsMobile';
import styles from '../stats.module.css';

// Mobile-responsive S10: horizontal-scroll wrapper for the wide stat blocks (adherence
// heatmap, monthly pivots). At ≤560px `.scroll` (stats.module.css) gives `overflow-x:auto`
// and the inner SVG keeps a readable width so the block scrolls instead of shrinking to fit.
// On mount (and when `dep`/`targetRatio` change) it scrolls so the relevant period is in
// view: by default the right edge (the monthly pivots only contain populated months, so the
// latest is rightmost); when `targetRatio` is given it lands on that fraction of the content
// instead — the heatmap is a full Jan→Dec grid whose tail is empty future cells, so it aims
// at the last logged day, not December. Presentation-only; desktop-inert (the effect no-ops
// when `useIsMobile()` is false and the wrapper has no overflow there).
interface Props {
  children: ReactNode;
  /** Re-applies the scroll when this value changes (e.g. the selected year). */
  dep?: unknown;
  /** 0–1 position of the period to bring into view; omitted → scroll to the right edge. */
  targetRatio?: number | undefined;
}

export function ScrollBlock({ children, dep, targetRatio }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  useLayoutEffect(() => {
    if (!isMobile) return;
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    if (max <= 0) return;
    if (targetRatio == null) {
      el.scrollLeft = max; // right edge = most-recent populated period
      return;
    }
    // Land the target near the right of the viewport (a timeline reads left→right), with a
    // small margin so the empty future tail is not what fills the screen.
    const target = targetRatio * el.scrollWidth - el.clientWidth * 0.9;
    el.scrollLeft = Math.max(0, Math.min(max, target));
  }, [isMobile, dep, targetRatio]);

  return (
    <div ref={ref} className={styles.scroll}>
      {children}
    </div>
  );
}
