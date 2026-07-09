import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import '../../../i18n/config';
import { ChronoSearchDialog } from './ChronoSearchDialog';

// B-206: the Chronodrive search dialog must focus its search input on open (so the mobile keyboard
// opens), not the modal's header "×". Focus lands via the Modal focus-trap initial-focus target
// (initialFocusRef → the forwardRef SearchField). Asserted through document.activeElement.

vi.mock('../useChronoSearch', () => ({
  useChronoSearch: () => ({
    data: [],
    isFetching: false,
    isError: false,
    error: null,
    isSuccess: false,
  }),
  useChronoProduct: () => ({ mutate: vi.fn(), isPending: false, isError: false, error: null }),
}));

afterEach(cleanup);

describe('ChronoSearchDialog', () => {
  it('focuses the search input on open', () => {
    render(<ChronoSearchDialog onClose={vi.fn()} onApplied={vi.fn()} />);
    const input = document.querySelector('input[type="search"]');
    expect(input).not.toBeNull();
    expect(document.activeElement).toBe(input);
  });
});
