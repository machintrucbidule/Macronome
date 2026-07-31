import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../../i18n/config';
import { NotFoundPage } from './NotFoundPage';

// B-241: an unknown URL used to render nothing at all — a blank page with no message and no way
// back. The screen must state what happened and offer the way home.
describe('NotFoundPage (B-241)', () => {
  it('states the address is unknown and links home', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/nowhere']}>
          <NotFoundPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByRole('heading', { name: i18n.t('notFound.title') })).toBeTruthy();
    expect(screen.getByText(i18n.t('notFound.body'))).toBeTruthy();
    expect(screen.getByRole('link', { name: i18n.t('notFound.home') }).getAttribute('href')).toBe(
      '/',
    );
  });
});
