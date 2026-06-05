import { useLayoutEffect, useState, type RefObject } from 'react';
import { fontForHeight } from '../../logic/fontAutosize';

// Observes the cook-list box height and returns the clamped font size for `lineCount` rows
// (specifications/screens/meals.md §Cook mode: the list fills the height without scrolling).
// Pure math lives in logic/fontAutosize.ts; this hook only wires the ResizeObserver.
export function useFontAutosize(ref: RefObject<HTMLElement | null>, lineCount: number): number {
  const [fontSize, setFontSize] = useState(fontForHeight(520, lineCount));

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const recompute = (): void => setFontSize(fontForHeight(el.clientHeight, lineCount));
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, lineCount]);

  return fontSize;
}
