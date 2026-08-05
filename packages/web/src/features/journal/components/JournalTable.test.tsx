import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { JournalRow as Row } from '@macronome/shared';
import '../../../i18n/config';
import { JournalTable } from './JournalTable';

// B-267: the Journal fetches and sorts the whole year but must not *mount* it — each row carries
// four interactive controls and a full year of them cost ~1s to open.
// B-275: rendering only ever **grows**. Nothing is unmounted behind you (scrolling back up must
// never blank), and the reserved height comes from a **measured** row pitch, so the scrollbar
// stops re-evaluating itself as you reach the bottom.
afterEach(cleanup);

const ROW_PX = 40;
const VIEWPORT = 768;

// jsdom gives every element a zero height and never scrolls, which would leave the pitch
// unmeasurable and the growth maths inert. Model a browser: the rows container is as tall as the
// rows it holds, and it sits at the top of the document — so its viewport-relative `top` moves up
// as the window scrolls, which is what `top + scrollY` (its document offset) is read from.
beforeEach(() => {
  window.scrollTo = vi.fn();
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const rows = this.querySelectorAll?.('tr[data-date]').length ?? 0;
    const height = rows > 0 ? rows * ROW_PX : 0;
    const top = -window.scrollY;
    return {
      height,
      width: 900,
      top,
      left: 0,
      right: 900,
      bottom: top + height,
      x: 0,
      y: top,
    } as DOMRect;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(window, 'scrollY', { value: 0, configurable: true, writable: true });
});

function year(days: number): Row[] {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(Date.UTC(2026, 0, 1 + i));
    return {
      date: d.toISOString().slice(0, 10),
      state: 'green',
      kcal: 2000,
      editable_kcal: false,
      macros: { L: 70, G: 200, P: 120 },
      effective_verdict: 'OK',
      verdict_auto: 'OK',
      verdict_override: null,
      activity_level: 'moderate',
      comment: null,
      kcal_gap: -50,
      burn_gap: -300,
    } as unknown as Row;
  });
}

function renderYear(days: number) {
  return render(
    <MemoryRouter>
      <JournalTable rows={year(days)} sort="date" dir="asc" onSort={vi.fn()} onPatch={vi.fn()} />
    </MemoryRouter>,
  );
}

const rowCount = (c: HTMLElement): number => c.querySelectorAll('tr[data-date]').length;
const reserved = (c: HTMLElement): number =>
  [...c.querySelectorAll('tbody[aria-hidden="true"] td')].reduce(
    (sum, td) => sum + Number.parseFloat((td as HTMLElement).style.height || '0'),
    0,
  );

/** Scroll the window to `y` and let the listener run. */
function scrollTo(y: number): void {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true, writable: true });
  act(() => {
    window.dispatchEvent(new Event('scroll'));
  });
}

describe('JournalTable — progressive rendering (B-267/B-275)', () => {
  it('mounts far fewer rows than the year holds', () => {
    const { container } = renderYear(366);
    expect(rowCount(container)).toBeGreaterThan(0);
    expect(rowCount(container)).toBeLessThan(366);
  });

  it('reserves the height of the days not drawn yet, from a measured pitch', () => {
    const { container } = renderYear(366);
    // Measured, not estimated: (366 − rendered) × the real 40px row.
    expect(reserved(container)).toBeCloseTo((366 - rowCount(container)) * ROW_PX, 0);
  });

  it('keeps the total height stable while scrolling — the scrollbar must not re-evaluate', () => {
    const { container } = renderYear(366);
    const total = () => rowCount(container) * ROW_PX + reserved(container);
    const before = total();
    scrollTo(2000);
    expect(total()).toBeCloseTo(before, 0);
    scrollTo(5000);
    expect(total()).toBeCloseTo(before, 0);
  });

  it('never takes back a row it has drawn (scrolling up must not blank)', () => {
    const { container } = renderYear(366);
    scrollTo(6000);
    const deep = rowCount(container);
    scrollTo(0);
    expect(rowCount(container)).toBe(deep);
  });

  it('jumps straight to what a far scroll demands, in one step', () => {
    const { container } = renderYear(366);
    const initial = rowCount(container);
    // Land near the bottom: everything up to there must render at once, not chunk by chunk.
    scrollTo(366 * ROW_PX - VIEWPORT);
    expect(rowCount(container)).toBe(366);
    expect(rowCount(container)).toBeGreaterThan(initial);
    expect(reserved(container)).toBe(0);
  });

  it('renders every row when the year is short enough to fit', () => {
    const { container } = renderYear(12);
    expect(rowCount(container)).toBe(12);
    expect(container.querySelectorAll('tbody[aria-hidden="true"]').length).toBe(0);
  });
});
