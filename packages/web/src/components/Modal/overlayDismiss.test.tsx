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
// tests dispatch the event themselves — which is exactly what the browser does on the gesture.

afterEach(() => {
  cleanup();
  resetOverlayStack();
  vi.restoreAllMocks();
});

beforeEach(() => {
  resetOverlayStack();
});

const back = (): void => {
  act(() => {
    window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
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
    const pushed = vi.spyOn(window.history, 'pushState');
    const consumed = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);

    const { unmount } = render(
      <Modal title="One" onClose={() => undefined}>
        body
      </Modal>,
    );
    expect(pushed).toHaveBeenCalledTimes(1);

    // Closed by Escape / the scrim / a save → the entry must not linger as a phantom the user
    // would have to walk back through.
    unmount();
    await flush();
    expect(consumed).toHaveBeenCalledTimes(1);
  });

  it('survives a StrictMode remount without closing itself', async () => {
    // The regression this guards: cleanup used to consume synchronously, and the resulting
    // popstate landed after the re-mount and shut the overlay the user had just opened.
    const consumed = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    const onClose = vi.fn();
    render(
      <StrictMode>
        <Modal title="One" onClose={onClose}>
          body
        </Modal>
      </StrictMode>,
    );
    await flush();
    expect(consumed).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(overlayDepth()).toBe(1);
  });

  it('does not consume the entry twice when Back itself did the closing', async () => {
    const consumed = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    const onClose = vi.fn();
    const { unmount } = render(
      <Modal title="One" onClose={onClose}>
        body
      </Modal>,
    );

    back(); // the browser already left our entry
    unmount(); // the overlay then unmounts in response
    await flush();
    expect(consumed).not.toHaveBeenCalled();
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
