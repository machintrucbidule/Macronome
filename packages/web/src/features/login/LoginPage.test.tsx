import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../../i18n/config';
import { LoginPage } from './LoginPage';

// B-084: the "stay signed in" checkbox must be checked by default
// (specifications/screens/login.md: "stay signed in checkbox (checked by default)").
function renderLogin() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(async () => {
  await i18n.changeLanguage('fr');
});
afterEach(() => {
  cleanup();
});

describe('LoginPage (B-084)', () => {
  it('checks the "stay signed in" box by default', () => {
    renderLogin();
    const checkbox = screen.getByRole<HTMLInputElement>('checkbox');
    expect(checkbox.checked).toBe(true);
  });
});
