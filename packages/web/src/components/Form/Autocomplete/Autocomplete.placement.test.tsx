import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { Autocomplete, type AutocompleteItem } from './Autocomplete';
import styles from './Autocomplete.module.css';

// B-233: the suggestion list flips above the field when there is no room below it. The placement is
// computed by lib/useMenuPlacement, so this drives the real geometry rather than mocking the hook.
//
// What has to be stubbed, and why: jsdom lays nothing out, so `getBoundingClientRect` returns zeroes
// and `offsetHeight` is always 0. The hook reads the WRAP's rect (where the field sits) and the LIST's
// `offsetHeight` (not its rect — it needs the rendered height). CSS modules are not applied under
// vitest, so every ancestor computes `overflow: visible` and the hook's clipBox() falls through to its
// viewport fallback — which is what makes these cases readable: one reference box, bounded by
// `window.innerHeight`.
const VIEWPORT_H = 800;

// CSS-module keys are typed optional; pin them once so both the stubs and the assertions agree.
const WRAP_CLASS = styles.wrap ?? 'wrap';
const AC_CLASS = styles.ac ?? 'ac';
const UP_CLASS = styles.up ?? 'up';

const ITEMS: AutocompleteItem[] = [
  { id: 'a', name: 'Avocat' },
  { id: 'b', name: 'Banane' },
];

// Live geometry: the stubs read it on every call, so a case can change the list's height between
// renders (that is how the "results arrive" case works).
const geo = { wrapTop: 0, wrapBottom: 0, listHeight: 0 };
const priorInnerHeight = window.innerHeight;
let rectSpy: ReturnType<typeof vi.spyOn> | null = null;

function hasClass(el: HTMLElement, name: string): boolean {
  return el.className.split(' ').includes(name);
}

function installGeometry(next: { wrapTop: number; wrapBottom: number; listHeight: number }): void {
  Object.assign(geo, next);
  Object.defineProperty(window, 'innerHeight', { value: VIEWPORT_H, configurable: true });

  // Keyed on the class because the hook measures during the initial layout effect — there is no
  // chance to grab the elements between render and measurement.
  rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ): DOMRect {
    const isWrap = hasClass(this, WRAP_CLASS);
    const top = isWrap ? geo.wrapTop : 0;
    const bottom = isWrap ? geo.wrapBottom : 0;
    return { top, bottom, left: 0, right: 200, width: 200, height: bottom - top } as DOMRect;
  });

  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return hasClass(this, AC_CLASS) ? geo.listHeight : 0;
    },
  });
}

function ac(items: AutocompleteItem[]) {
  return (
    <Autocomplete
      query="a"
      onQueryChange={vi.fn()}
      items={items}
      emptyLabel="Aucun"
      onPick={vi.fn()}
      onClose={vi.fn()}
    />
  );
}

function renderAc(items: AutocompleteItem[]) {
  const { container, rerender } = render(ac(items));
  const list = (): HTMLElement => container.querySelector('[role="listbox"]') as HTMLElement;
  return { list, rerender };
}

afterEach(() => {
  cleanup();
  rectSpy?.mockRestore();
  rectSpy = null;
  Reflect.deleteProperty(HTMLElement.prototype, 'offsetHeight');
  Object.defineProperty(window, 'innerHeight', { value: priorInnerHeight, configurable: true });
});

describe('Autocomplete vertical placement (B-233)', () => {
  it('flips above the field when the list does not fit below it', () => {
    // 70px below the field, a 300px list: the reported symptom (a line at the bottom of Repas).
    installGeometry({ wrapTop: 700, wrapBottom: 730, listHeight: 300 });
    const { list } = renderAc(ITEMS);

    expect(hasClass(list(), UP_CLASS)).toBe(true);
  });

  it('stays below the field when there is room', () => {
    installGeometry({ wrapTop: 10, wrapBottom: 40, listHeight: 300 });
    const { list } = renderAc(ITEMS);

    expect(hasClass(list(), UP_CLASS)).toBe(false);
  });

  // It is the measured HEIGHT that decides, not merely how low the field sits: a short list still
  // fits under a low field, and flipping it would be gratuitous movement.
  it('does not flip a short list that still fits under a low field', () => {
    installGeometry({ wrapTop: 700, wrapBottom: 730, listHeight: 40 });
    const { list } = renderAc(ITEMS);

    expect(hasClass(list(), UP_CLASS)).toBe(false);
  });

  // Results arrive asynchronously and change the list's height; passing `items.length` as the hook's
  // `count` is what makes it re-measure. Without it the first (empty, short) measurement would stick.
  it('re-measures when results arrive and grow the list', () => {
    installGeometry({ wrapTop: 700, wrapBottom: 730, listHeight: 0 });
    const { list, rerender } = renderAc([]);
    expect(hasClass(list(), UP_CLASS)).toBe(false);

    geo.listHeight = 300;
    rerender(ac(ITEMS));

    expect(hasClass(list(), UP_CLASS)).toBe(true);
  });
});
