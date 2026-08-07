import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Container } from '@macronome/shared';
import '../../../i18n/config';
import { ContainersMobile } from './ContainersMobile';

// B-328: Contenants keeps its floating "+" on a phone. The contract used to name three screens
// (Aliments / Recettes / Poids) while the app had shipped four since this screen's mobile slice;
// the owner kept the control and `design/components/bottom-nav.md` now states the structural rule
// — a card list whose main action is "add one" — which this screen meets. `fab-screens.test.ts`
// guards the list; this guards that the button is really there and really adds.

const ROWS: Container[] = [
  { id: 'c1', name: 'Assiette', empty_weight_g: 650, is_builtin: false },
  { id: 'c2', name: 'Rien', empty_weight_g: 0, is_builtin: true },
];

function renderMobile(onAdd = vi.fn()) {
  render(
    <ContainersMobile
      rows={ROWS}
      loading={false}
      q=""
      sort="name"
      dir="asc"
      onQ={vi.fn()}
      onSort={vi.fn()}
      onAdd={onAdd}
      onOpen={vi.fn()}
    />,
  );
  return onAdd;
}

afterEach(cleanup);

describe('ContainersMobile — the add FAB (B-328)', () => {
  it('renders the floating add button', () => {
    renderMobile();
    expect(screen.getByRole('button', { name: '+ Ajouter' })).toBeTruthy();
  });

  it('opens the add form when it is pressed', () => {
    const onAdd = renderMobile();
    fireEvent.click(screen.getByRole('button', { name: '+ Ajouter' }));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });
});
