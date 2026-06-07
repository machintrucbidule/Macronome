import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18n from '../../i18n/config';
import { Banner } from './Banner';

// Banner (toasts-warnings.md §D): non-blocking failure banners are dismissible — the close
// (×) affordance appears only when an onDismiss handler is supplied; persistent warnings
// (e.g. the Cibles inconsistency notice) omit it and stay visible.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Banner', () => {
  it('shows a close button that calls onDismiss when provided', () => {
    const onDismiss = vi.fn();
    render(
      <Banner tone="warning" onDismiss={onDismiss}>
        Boom
      </Banner>,
    );
    expect(screen.getByText('Boom')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('common.close') }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders no close button without onDismiss (persistent warning)', () => {
    render(<Banner tone="warning">Persistent</Banner>);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
