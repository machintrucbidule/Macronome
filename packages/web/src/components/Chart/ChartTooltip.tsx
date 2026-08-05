import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './Chart.module.css';

// Styled chart tooltip (B-056; refined CT-1/B-140). The weight chart, the two Stats bar charts
// and the heatmap use this floating card instead of the native <title>. Structured multi-line
// content (centered title + one value per line), a caret pointing at the anchor, and — key for
// mobile — it is portaled to <body> and `position: fixed`, so it escapes the horizontal-scroll
// wrappers and flips/clamps against the real viewport. Pure presentation (CLAUDE.md rule 2).
export interface TipContent {
  title: string;
  rows: string[];
}
/** viewBox anchor carried by a column/point hit before it is mapped to client coords. */
export interface TooltipPoint {
  cx: number;
  cy: number;
  tip: TipContent;
}
/** Resolved client/viewport anchor the card is drawn at (portaled to <body>, fixed). */
export interface TooltipAnchor {
  x: number;
  y: number;
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
// residual overflow). The card is fixed-positioned in a body portal, so nothing clips it.
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

export function ChartTooltip({ anchor }: { anchor: TooltipAnchor }) {
  const sig = `${anchor.x},${anchor.y}`;
  const { ref, place } = useViewportClamp(sig);
  const transform = `translate(calc(-50% + ${place.dx}px), ${
    place.below ? 'calc(8px)' : 'calc(-100% - 8px)'
  })`;

  return createPortal(
    <div
      ref={ref}
      className={`${styles.tooltip}${place.below ? ` ${styles.below}` : ''}`}
      style={{
        left: `${anchor.x}px`,
        top: `${anchor.y}px`,
        transform,
        // keep the caret over the anchor even after a horizontal clamp
        ['--caret-x' as string]: `clamp(8px, calc(50% - ${place.dx}px), calc(100% - 8px))`,
      }}
      // B-272: deliberately NOT role="status". This tooltip is hover-driven, so announcing it as
      // a status fires on every pointer move — noise, not information. The figures it shows are
      // all readable from the chart's own data elsewhere on the screen.
      data-testid="chart-tooltip"
    >
      <div className={styles.tipTitle}>{anchor.tip.title}</div>
      {anchor.tip.rows.map((row, i) => (
        <div className={styles.tipRow} key={i}>
          {row}
        </div>
      ))}
    </div>,
    document.body,
  );
}
