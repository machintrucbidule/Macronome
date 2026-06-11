import { useLayoutEffect, useRef, useState } from 'react';
import type { ChartBox } from './scale';
import styles from './Chart.module.css';

// Styled chart tooltip (B-056; design/components/charts.md §Shared primitives). The weight
// chart and the two Stats bar charts use this floating HTML card instead of the native <title>.
// CT-1/B-140: structured multi-line content (bold title + one value per line), a caret pointing
// at the anchor, and viewport flip/clamp so it is never clipped. Pure presentation — it only
// formats values it receives (CLAUDE.md rule 2 untouched).
export interface TipContent {
  title: string;
  rows: string[];
}
export interface TooltipPoint {
  cx: number;
  cy: number;
  tip: TipContent;
}

const MARGIN = 6; // keep at least this many px from every viewport edge

interface Placement {
  dx: number; // horizontal correction (px) applied to the card
  below: boolean; // card flipped under the anchor (default is above)
}

// Residual horizontal overflow (px) for the current card rect, 0 when it fits.
function clampDx(r: DOMRect): number {
  if (r.left < MARGIN) return MARGIN - r.left;
  if (r.right > window.innerWidth - MARGIN) return window.innerWidth - MARGIN - r.right;
  return 0;
}

// Measure the rendered card against the viewport and nudge it back in-view. Runs after every
// layout: resets when the anchor moves, then converges in a pass or two (each run cancels the
// residual overflow). Position-only, so cx/cy map 1:1 to the viewBox (the SVG is xMidYMid meet).
function useViewportClamp(sig: string): {
  ref: React.RefObject<HTMLDivElement>;
  place: Placement;
} {
  const ref = useRef<HTMLDivElement>(null);
  const lastSig = useRef('');
  const passes = useRef(0);
  const [place, setPlace] = useState<Placement>({ dx: 0, below: false });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (lastSig.current !== sig) {
      lastSig.current = sig;
      passes.current = 0;
      if (place.dx !== 0 || place.below) {
        setPlace({ dx: 0, below: false }); // fresh anchor → measure from the base next pass
        return;
      }
    }
    const r = el.getBoundingClientRect();
    // Bail when the card is not laid out (zero box, e.g. jsdom) or after a couple of passes —
    // each pass cancels the residual overflow, so it converges; the cap is a loop backstop.
    if ((r.width === 0 && r.height === 0) || passes.current >= 3) return;
    passes.current += 1;
    const dxAdd = clampDx(r);
    const needBelow = !place.below && r.top < MARGIN;
    if (dxAdd !== 0 || needBelow) {
      setPlace((p) => ({ dx: p.dx + dxAdd, below: p.below || needBelow }));
    }
  }, [sig, place]);

  return { ref, place };
}

export function ChartTooltip({ point, box }: { point: TooltipPoint; box: ChartBox }) {
  const sig = `${point.cx},${point.cy}`;
  const { ref, place } = useViewportClamp(sig);
  const transform = `translate(calc(-50% + ${place.dx}px), ${
    place.below ? 'calc(8px)' : 'calc(-100% - 8px)'
  })`;

  return (
    <div
      ref={ref}
      className={`${styles.tooltip}${place.below ? ` ${styles.below}` : ''}`}
      style={{
        left: `${(point.cx / box.w) * 100}%`,
        top: `${(point.cy / box.h) * 100}%`,
        transform,
        // keep the caret over the anchor even after a horizontal clamp
        ['--caret-x' as string]: `clamp(8px, calc(50% - ${place.dx}px), calc(100% - 8px))`,
      }}
      role="status"
    >
      <div className={styles.tipTitle}>{point.tip.title}</div>
      {point.tip.rows.map((row, i) => (
        <div className={styles.tipRow} key={i}>
          {row}
        </div>
      ))}
    </div>
  );
}
