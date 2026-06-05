// View-only sizing oracle for cook mode (specifications/screens/meals.md §Cook mode):
// the left list font auto-scales so the lines fill the available height without scrolling.
// Simple line-count heuristic, clamped 16–40 px (mockup meals.html: max(16, min(40,
// floor(h / n * 0.34)))). Pure so it can be unit-tested; the hook wraps it with a ResizeObserver.
export const COOK_FONT_MIN = 16;
export const COOK_FONT_MAX = 40;

export function fontForHeight(height: number, lineCount: number): number {
  const n = Math.max(lineCount, 1);
  const raw = Math.floor((height / n) * 0.34);
  return Math.max(COOK_FONT_MIN, Math.min(COOK_FONT_MAX, raw));
}
