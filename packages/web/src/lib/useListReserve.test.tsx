import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { useListReserve, type ListReserveQuery } from './useListReserve';

// B-278: Aliments and Recettes fetch 50 rows at a time, so the scrollbar used to reflect only what
// was loaded. The server now reports how many rows match, and the list reserves the height of the
// rest — plus keeps pulling pages while the scroll position asks for rows beyond those loaded,
// without which the reserved area would be a trap (the sentinel only fires when it is near).
afterEach(cleanup);

const ROW_PX = 40;

beforeEach(() => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const rows = this.querySelectorAll?.('[data-row]').length ?? 0;
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

function Harness({
  loaded,
  total,
  query,
}: {
  loaded: number;
  total: number | undefined;
  query: ListReserveQuery;
}) {
  const reserve = useListReserve(loaded, total, query);
  return (
    <>
      <div ref={reserve.listRef as React.RefObject<HTMLDivElement>}>
        {Array.from({ length: loaded }, (_, i) => (
          <div key={i} data-row="" />
        ))}
      </div>
      <div data-testid="pad" style={{ height: reserve.padBottom }} />
    </>
  );
}

const idle: ListReserveQuery = {
  hasNextPage: true,
  isFetchingNextPage: false,
  fetchNextPage: () => undefined,
};

const pad = (c: HTMLElement): number =>
  Number.parseFloat((c.querySelector('[data-testid="pad"]') as HTMLElement).style.height || '0');

function scrollTo(y: number): void {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true, writable: true });
  act(() => {
    window.dispatchEvent(new Event('scroll'));
  });
}

describe('useListReserve (B-278)', () => {
  it('reserves the height of the rows the server has but we have not loaded', () => {
    const { container } = render(<Harness loaded={50} total={400} query={idle} />);
    expect(pad(container)).toBeCloseTo(350 * ROW_PX, 0);
  });

  it('reserves nothing once everything is loaded', () => {
    const { container } = render(
      <Harness loaded={40} total={40} query={{ ...idle, hasNextPage: false }} />,
    );
    expect(pad(container)).toBe(0);
  });

  it('reserves nothing before the first page reports a total', () => {
    const { container } = render(<Harness loaded={0} total={undefined} query={idle} />);
    expect(pad(container)).toBe(0);
  });

  it('pulls the next page when the scroll position asks for rows beyond those loaded', () => {
    const fetchNextPage = vi.fn();
    render(<Harness loaded={50} total={400} query={{ ...idle, fetchNextPage }} />);
    fetchNextPage.mockClear();

    scrollTo(50 * ROW_PX); // past the loaded rows, into the reserved area
    expect(fetchNextPage).toHaveBeenCalled();
  });

  it('never pulls while a page is already in flight — cursor pages are sequential', () => {
    const fetchNextPage = vi.fn();
    render(
      <Harness
        loaded={50}
        total={400}
        query={{ hasNextPage: true, isFetchingNextPage: true, fetchNextPage }}
      />,
    );
    scrollTo(50 * ROW_PX);
    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  it('stops pulling when the server says there is no next page', () => {
    const fetchNextPage = vi.fn();
    render(
      <Harness
        loaded={50}
        total={50}
        query={{ hasNextPage: false, isFetchingNextPage: false, fetchNextPage }}
      />,
    );
    scrollTo(5000);
    expect(fetchNextPage).not.toHaveBeenCalled();
  });
});
