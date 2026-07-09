import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SettingsCard } from './SettingsCard';

// SettingsCard (B-209): the shared collapsible card shell for Paramètres. Default open/collapsed,
// toggle on title click, and per-id persistence in localStorage (macronome.settings.collapsed).
// jsdom provides a real localStorage; clear it between tests.
afterEach(() => {
  cleanup();
  localStorage.clear();
});

function renderCard(props: { defaultOpen?: boolean; aside?: ReactNode } = {}) {
  return render(
    <SettingsCard id="demo" title="Demo card" {...props}>
      <p>Body content</p>
    </SettingsCard>,
  );
}

const toggle = () => screen.getByRole('button', { name: /Demo card/ });

describe('SettingsCard (B-209)', () => {
  it('renders open by default: body visible, aria-expanded true', () => {
    renderCard();
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Body content')).toBeTruthy();
  });

  it('defaultOpen=false: body hidden, aria-expanded false', () => {
    renderCard({ defaultOpen: false });
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Body content')).toBeNull();
  });

  it('toggles the body open on a title click', () => {
    renderCard({ defaultOpen: false });
    fireEvent.click(toggle());
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Body content')).toBeTruthy();
  });

  it('persists the collapsed state and re-reads it on remount (stored state wins)', () => {
    const { unmount } = renderCard(); // open by default
    fireEvent.click(toggle()); // collapse
    expect(screen.queryByText('Body content')).toBeNull();
    expect(JSON.parse(localStorage.getItem('macronome.settings.collapsed') ?? '{}')).toEqual({
      demo: false,
    });
    unmount();
    renderCard(); // defaultOpen true, but the stored state says collapsed
    expect(screen.queryByText('Body content')).toBeNull();
  });

  it('keeps the header aside visible when collapsed', () => {
    renderCard({ defaultOpen: false, aside: <span>meta-info</span> });
    expect(screen.getByText('meta-info')).toBeTruthy();
    expect(screen.queryByText('Body content')).toBeNull();
  });
});
