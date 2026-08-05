import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { JournalRow as Row } from '@macronome/shared';
import '../../../i18n/config';
import { ROW_OVERSCAN } from '../../../lib/useWindowRows';
import { JournalTable } from './JournalTable';

// B-267: the Journal fetches and sorts the whole year, but must not *mount* it — each row carries
// four interactive controls (calories cell, verdict badge, activity select, comment field) and a
// full year of them cost about a second to open.
afterEach(cleanup);

const ROW_PX = 38;

// jsdom gives every element a zero height, which would make the virtualiser think the whole year
// fits on screen and defeat the very thing under test. Give the rows a height, as a browser would.
beforeEach(() => {
  window.scrollTo = vi.fn();
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const height = this.matches('tr[data-date]') ? ROW_PX : 0;
    return {
      height,
      width: 900,
      top: 0,
      left: 0,
      right: 900,
      bottom: height,
      x: 0,
      y: 0,
    } as DOMRect;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
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

describe('JournalTable — virtualised rows (B-267)', () => {
  it('mounts far fewer rows than the year holds', () => {
    const { container } = renderYear(366);
    const mounted = container.querySelectorAll('tr[data-date]').length;
    expect(mounted).toBeGreaterThan(0);
    expect(mounted).toBeLessThan(366);
  });

  it('keeps a generous margin of rows loaded around the viewport', () => {
    const { container } = renderYear(366);
    // The owner asked for rows to stay loaded beyond what is displayed, not just the visible ones.
    expect(container.querySelectorAll('tr[data-date]').length).toBeGreaterThanOrEqual(ROW_OVERSCAN);
  });

  it('reserves the height of the rows it did not mount, so the scrollbar spans the year', () => {
    const { container } = renderYear(366);
    const spacers = [...container.querySelectorAll('tr[aria-hidden="true"] td')];
    const reserved = spacers.reduce(
      (sum, td) => sum + Number.parseFloat((td as HTMLElement).style.height || '0'),
      0,
    );
    expect(reserved).toBeGreaterThan(0);
  });

  it('renders every row when the year is short enough to fit', () => {
    const { container } = renderYear(12);
    expect(container.querySelectorAll('tr[data-date]').length).toBe(12);
    expect(container.querySelectorAll('tr[aria-hidden="true"]').length).toBe(0);
  });
});
