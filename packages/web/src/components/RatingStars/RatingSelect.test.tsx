import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Rating } from '@macronome/shared';
import i18n from '../../i18n/config';
import { RatingSelect } from './RatingSelect';

// B-121: the rating picker is a dropdown exposing all five states distinctly —
// Pas noté (null) + 0/Bof + 1/2/3 — so unrated is reachable and never confused with 0.
afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('fr');
});

function open(value: Rating, onChange = vi.fn()) {
  render(<RatingSelect value={value} onChange={onChange} ariaLabel="note" />);
  fireEvent.click(screen.getByRole('button', { name: 'note' }));
  return { onChange };
}

describe('RatingSelect (B-121) — five distinct rating states', () => {
  it('lists all five states when opened', () => {
    open(null);
    expect(screen.getAllByRole('option')).toHaveLength(5);
  });

  // Options are ordered: 0=Pas noté, 1=Bof(0), 2=Moyen(1), 3=Ok(2), 4=Top(3).
  it.each<[number, Rating]>([
    [0, null],
    [1, 0],
    [2, 1],
    [3, 2],
    [4, 3],
  ])('selecting option #%i emits rating %s', (idx, expected) => {
    const { onChange } = open(3); // open from a known non-null state
    fireEvent.click(screen.getAllByRole('option')[idx]!);
    expect(onChange).toHaveBeenCalledWith(expected);
  });

  it('renders unrated ("Pas noté") distinctly from 0/Bof (empty stars), no grade text', () => {
    open(null);
    const [unrated, bof] = screen.getAllByRole('option');
    // Unrated shows the "Pas noté" label and no stars.
    expect(unrated!.textContent).toBe(i18n.t('rating.unrated'));
    expect(unrated!.textContent).not.toContain('★');
    // 0/Bof shows three stars only — no "Bof" (or any grade) text label was added.
    expect(bof!.textContent?.replace(/\s/g, '')).toBe('★★★');
    expect(bof!.textContent).not.toContain(i18n.t('rating.bof'));
  });
});
