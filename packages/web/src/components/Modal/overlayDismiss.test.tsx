import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { StrictMode } from 'react';
import '../../i18n/config';
import { Modal } from './Modal';
import { overlayDepth, resetOverlayStack } from './useOverlayDismiss';

// B-269: the hardware/gesture Back and the browser Back button close the TOP-MOST overlay instead
// of navigating the SPA away and unmounting it as collateral. Escape and Back read the same
// mount-order stack, so nesting behaves identically for both.
//
// jsdom implements history + popstate but does not fire popstate for programmatic back(), so the
// tests stand in a small fake history stack: pushState records the entry, back() drops it, restores
// the previous state and emits popstate — exactly what the browser does on the gesture. Faking the
// WHOLE chain (rather than no-op'ing back()) is what makes B-300 observable: the consume a closing
// child fires really does land a popstate on its parent.

/**
 * `pushed` / `consumed` spy on pushState / back — `consumed` counts the consumes the HOOK
 * performs, while `goBack` stands in for the user's own Back gesture (same effect, not counted).
 */
function installFakeHistory() {
  const origPush = window.history.pushState.bind(window.history);
  const origReplace = window.history.replaceState.bind(window.history);
  const entries: unknown[] = [window.history.state];
  const goBack = (): void => {
    if (entries.length <= 1) return;
    entries.pop();
    origReplace(entries[entries.length - 1] ?? null, '');
    window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
  };
  const pushed = vi.spyOn(window.history, 'pushState').mockImplementation((state: unknown) => {
    entries.push(state);
    origPush(state, '');
  });
  const consumed = vi.spyOn(window.history, 'back').mockImplementation(goBack);
  return { pushed, consumed, goBack };
}

let hist: ReturnType<typeof installFakeHistory>;

afterEach(() => {
  cleanup();
  resetOverlayStack();
  vi.restoreAllMocks();
});

beforeEach(() => {
  resetOverlayStack();
  hist = installFakeHistory();
});

const back = (): void => {
  act(() => {
    hist.goBack();
  });
};

/** The consume is deferred by a tick so a StrictMode remount can cancel it — wait it out. */
const flush = (): Promise<void> =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 1));
  });

const escape = (): void => {
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  });
};

describe('Back closes the top overlay (B-269)', () => {
  it('closes the only open overlay', () => {
    const onClose = vi.fn();
    render(
      <Modal title="One" onClose={onClose}>
        body
      </Modal>,
    );
    expect(overlayDepth()).toBe(1);

    back();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes ONE of two nested overlays — the top one only', () => {
    const closeOuter = vi.fn();
    const closeInner = vi.fn();
    render(
      <>
        <Modal title="Outer" onClose={closeOuter}>
          outer
        </Modal>
        <Modal title="Inner" onClose={closeInner}>
          inner
        </Modal>
      </>,
    );
    expect(overlayDepth()).toBe(2);

    back();
    expect(closeInner).toHaveBeenCalledTimes(1);
    expect(closeOuter).not.toHaveBeenCalled();
  });
});

describe('the overlay history entry is exactly balanced (B-269)', () => {
  it('pushes one entry per overlay, and consumes it on a non-Back close', async () => {
    const { unmount } = render(
      <Modal title="One" onClose={() => undefined}>
        body
      </Modal>,
    );
    expect(hist.pushed).toHaveBeenCalledTimes(1);

    // Closed by Escape / the scrim / a save → the entry must not linger as a phantom the user
    // would have to walk back through.
    unmount();
    await flush();
    expect(hist.consumed).toHaveBeenCalledTimes(1);
  });

  it('survives a StrictMode remount without closing itself', async () => {
    // The regression this guards: cleanup used to consume synchronously, and the resulting
    // popstate landed after the re-mount and shut the overlay the user had just opened.
    const onClose = vi.fn();
    render(
      <StrictMode>
        <Modal title="One" onClose={onClose}>
          body
        </Modal>
      </StrictMode>,
    );
    await flush();
    expect(hist.consumed).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(overlayDepth()).toBe(1);
  });

  it('does not consume the entry twice when Back itself did the closing', async () => {
    const onClose = vi.fn();
    const { unmount } = render(
      <Modal title="One" onClose={onClose}>
        body
      </Modal>,
    );

    back(); // the browser already left our entry
    unmount(); // the overlay then unmounts in response
    await flush();
    expect(hist.consumed).not.toHaveBeenCalled();
  });

  it('leaves the stack empty once every overlay has unmounted', () => {
    const { unmount } = render(
      <Modal title="One" onClose={() => undefined}>
        body
      </Modal>,
    );
    unmount();
    expect(overlayDepth()).toBe(0);

    // With nothing open, Back is nobody's business — no handler remains to swallow it, so the
    // navigation happens normally.
    expect(() => back()).not.toThrow();
  });

  it('Escape still closes only the top overlay, off the same stack', () => {
    const closeOuter = vi.fn();
    const closeInner = vi.fn();
    render(
      <>
        <Modal title="Outer" onClose={closeOuter}>
          outer
        </Modal>
        <Modal title="Inner" onClose={closeInner}>
          inner
        </Modal>
      </>,
    );
    escape();
    expect(closeInner).toHaveBeenCalledTimes(1);
    expect(closeOuter).not.toHaveBeenCalled();
  });
});

describe('a closing sub-dialog leaves the overlay beneath it open (B-300)', () => {
  interface PairProps {
    inner: boolean;
    closeOuter: () => void;
    closeInner: () => void;
  }
  // The real shape of every nesting site (FoodModal → ParseLabelDialog / ChronoSearchDialog,
  // CustomFoodModal → AiDishAnalysisDialog, RecipeBuilderModal → IngredientPickerSheet): the child
  // is a conditional render inside the parent's subtree, so closing it unmounts it alone.
  const Pair = ({ inner, closeOuter, closeInner }: PairProps) => (
    <Modal title="Outer" onClose={closeOuter}>
      outer
      {inner && (
        <Modal title="Inner" onClose={closeInner}>
          inner
        </Modal>
      )}
    </Modal>
  );

  it('does not close the parent when the child unmounts and consumes its entry', async () => {
    const closeOuter = vi.fn();
    const closeInner = vi.fn();
    // Open the parent FIRST, then the child — the order the user produces, and the one that puts
    // the child on top of the stack (React runs a child's effects before its parent's, so mounting
    // both in the same commit would register them the other way round).
    const { rerender } = render(
      <Pair inner={false} closeOuter={closeOuter} closeInner={closeInner} />,
    );
    rerender(<Pair inner closeOuter={closeOuter} closeInner={closeInner} />);
    expect(overlayDepth()).toBe(2);

    // Escape / the scrim / × / a successful "Choisir" or "Parser" all end the same way: the child
    // unmounts, and its deferred consume fires a history.back() that lands on the PARENT's entry.
    rerender(<Pair inner={false} closeOuter={closeOuter} closeInner={closeInner} />);
    await flush();

    expect(hist.consumed).toHaveBeenCalledTimes(1); // the child consumed its own entry…
    expect(closeOuter).not.toHaveBeenCalled(); // …and the parent stayed open
    expect(overlayDepth()).toBe(1);
  });

  it('still lets a real Back close the child alone', async () => {
    const closeOuter = vi.fn();
    const closeInner = vi.fn();
    const { rerender } = render(
      <Pair inner={false} closeOuter={closeOuter} closeInner={closeInner} />,
    );
    rerender(<Pair inner closeOuter={closeOuter} closeInner={closeInner} />);

    back();
    await flush();
    expect(closeInner).toHaveBeenCalledTimes(1);
    expect(closeOuter).not.toHaveBeenCalled();
  });
});
