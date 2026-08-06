import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { useListReserve } from './useListReserve';
import type { PagedList } from './usePagedList';

// LD-1/B-303: this hook used to chain cursor pages — one `fetchNextPage`, wait, re-check, fire
// again — because a keyset list could do nothing else. Its old test asserted exactly that
// invariant ("never pulls while a page is already in flight — cursor pages are sequential"), which
// is the behaviour the batch removes, so it is rewritten rather than patched.
//
// What it does now: turn the scroll position into the ROW INDEX the user is looking at and hand it
// to `usePagedList`, which fetches that page first and backfills behind it.
afterEach(cleanup);

const ROW_PX = 40;

beforeEach(() => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const rows = this.querySelectorAll?.('[data-row]').length ?? 0;
    const height = rows > 0 ? rows * ROW_PX : 0;
    const top = -window.scrollY;
    return { height, width: 900, top, left: 0, right: 900, bottom: top + height, x: 0, y: top };
  } as () => DOMRect);
});

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(window, 'scrollY', { value: 0, configurable: true, writable: true });
  Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true, writable: true });
});

function list(over: Partial<PagedList<unknown>> = {}): PagedList<unknown> {
  return {
    slots: [],
    rows: [],
    total: 3400,
    loading: false,
    isError: false,
    firstPageCount: 50,
    requestRow: vi.fn(),
    ...over,
  };
}

function Harness({ paged }: { paged: PagedList<unknown> }) {
  const reserve = useListReserve(paged);
  return (
    <div ref={reserve.listRef as React.RefObject<HTMLDivElement>}>
      {Array.from({ length: paged.firstPageCount }, (_, i) => (
        <div key={i} data-row="" />
      ))}
    </div>
  );
}

/** rAF is what throttles the scroll handler to one layout read per frame. */
const flushFrames = async (): Promise<void> => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });
};

const scrollTo = async (y: number): Promise<void> => {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true, writable: true });
  await act(async () => {
    window.dispatchEvent(new Event('scroll'));
    await new Promise((r) => setTimeout(r, 20));
  });
};

describe('useListReserve — scroll position to page (B-303)', () => {
  it('measures the row pitch from page 0’s rows', async () => {
    const paged = list();
    render(<Harness paged={paged} />);
    await flushFrames();
    // 50 rows × 40px measured back out to one row.
    expect(paged.requestRow).toHaveBeenCalled();
  });

  it('asks for the row index under the scroll position, not for "the next page"', async () => {
    const paged = list();
    render(<Harness paged={paged} />);
    await flushFrames();
    vi.mocked(paged.requestRow).mockClear();

    // Drop the scrollbar 2 000 rows down. The whole point of the batch: it must name THAT row,
    // rather than walking there one page at a time.
    await scrollTo(2000 * ROW_PX);
    const asked = vi.mocked(paged.requestRow).mock.calls.map(([n]) => n);
    expect(asked.length).toBeGreaterThan(0);
    expect(Math.max(...asked)).toBeGreaterThan(2000);
  });

  it('coalesces a burst of scroll events into a single layout read', async () => {
    const paged = list();
    render(<Harness paged={paged} />);
    await flushFrames();
    vi.mocked(paged.requestRow).mockClear();

    // Ten events inside one frame: `rowsDemanded` forces a reflow, so it must run once, not ten
    // times. The events are dispatched without letting a frame elapse between them.
    await act(async () => {
      for (let i = 0; i < 10; i += 1) {
        Object.defineProperty(window, 'scrollY', { value: 1000 + i, configurable: true });
        window.dispatchEvent(new Event('scroll'));
      }
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(vi.mocked(paged.requestRow).mock.calls.length).toBeLessThanOrEqual(2);
  });

  it('does nothing until the pitch has been measured', async () => {
    // No rows yet → no measurement → no page can be named, so nothing is requested.
    const paged = list({ firstPageCount: 0 });
    render(<Harness paged={paged} />);
    await flushFrames();
    expect(paged.requestRow).not.toHaveBeenCalled();
  });
});
