import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import '../../i18n/config';
import { Modal } from './Modal';

// The background scroll lock. Without it the wheel chains out of the panel to the document, which
// slides behind the fixed scrim — the leftover-modal container list made that obvious. The lock is
// ref-counted, so a nested sub-dialog closing on its own must not release it.
afterEach(cleanup);

const noop = (): void => {};

describe('Modal background scroll lock', () => {
  it('freezes the body while open and restores on close', () => {
    document.body.style.overflow = '';
    const { unmount } = render(
      <Modal title="T" onClose={noop}>
        body
      </Modal>,
    );
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('restores the previous value rather than blanking it', () => {
    document.body.style.overflow = 'scroll';
    const { unmount } = render(
      <Modal title="T" onClose={noop}>
        body
      </Modal>,
    );
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('scroll');
    document.body.style.overflow = '';
  });

  it('keeps the lock until the last of two nested modals closes', () => {
    document.body.style.overflow = '';
    const outer = render(
      <Modal title="outer" onClose={noop}>
        outer body
      </Modal>,
    );
    const inner = render(
      <Modal title="inner" onClose={noop}>
        inner body
      </Modal>,
    );
    expect(document.body.style.overflow).toBe('hidden');

    inner.unmount();
    expect(document.body.style.overflow).toBe('hidden'); // outer still open

    outer.unmount();
    expect(document.body.style.overflow).toBe('');
  });
});
