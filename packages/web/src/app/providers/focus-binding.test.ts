import { afterEach, describe, expect, it, vi } from 'vitest';
import { focusManager } from '@tanstack/react-query';
import { bindWindowFocus } from './focus-binding';

// B-294 / D17: query-core binds `visibilitychange` only, which a non-minimised Windows PWA window
// never emits on alt-tab — so in the installed app NO query refetched on return to focus. The
// binding must react to a bare `focus` event too.
let unbind: (() => void) | null = null;
afterEach(() => {
  unbind?.();
  unbind = null;
  vi.restoreAllMocks();
});

describe('bindWindowFocus (B-294)', () => {
  it('reacts to a bare window focus event', () => {
    const seen = vi.fn();
    unbind = bindWindowFocus();
    const stop = focusManager.subscribe(() => {
      seen();
    });

    window.dispatchEvent(new Event('focus'));

    expect(seen).toHaveBeenCalled();
    stop();
  });

  it('still reacts to visibilitychange', () => {
    const seen = vi.fn();
    unbind = bindWindowFocus();
    const stop = focusManager.subscribe(() => {
      seen();
    });

    window.dispatchEvent(new Event('visibilitychange'));

    expect(seen).toHaveBeenCalled();
    stop();
  });

  it('removes both listeners when unbound', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const done = bindWindowFocus();
    // A live subscriber is what makes query-core attach the listener in the first place.
    const stop = focusManager.subscribe(() => undefined);
    done();
    stop();

    const events = remove.mock.calls.map((c) => c[0]);
    expect(events).toContain('focus');
    expect(events).toContain('visibilitychange');
  });
});
