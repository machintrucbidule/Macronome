import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { JournalRow as Row } from '@macronome/shared';
import i18n from '../../../i18n/config';
import { JournalDaySheet } from './JournalDaySheet';

// B-250: the mobile day sheet's kcal field follows the desktop cell — seeded at display
// precision (integer kcal), never the raw derived sum.
afterEach(cleanup);

function summaryRow(kcal: number): Row {
  return {
    date: '2026-01-01',
    kcal,
    macros: null,
    verdict_auto: null,
    verdict_override: null,
    effective_verdict: null,
    kcal_gap: null,
    burn_gap: null,
    activity_level: 'sedentary',
    comment: null,
    kind: 'summary',
    state: 'yellow',
    tone: 'none',
    editable_kcal: true,
  };
}

function renderSheet(kcal: number) {
  return render(
    <MemoryRouter>
      <JournalDaySheet row={summaryRow(kcal)} onClose={vi.fn()} onPatch={vi.fn()} />
    </MemoryRouter>,
  );
}

const kcalInput = (): HTMLInputElement =>
  screen.getByPlaceholderText<HTMLInputElement>(i18n.t('journal.kcalPlaceholder'));

describe('JournalDaySheet kcal field seeding (B-250)', () => {
  it('seeds the integer kcal, not the raw sum', () => {
    renderSheet(1873.45);
    expect(kcalInput().value).toBe('1873');
  });

  it('leaves the field empty on a day with no calories', () => {
    renderSheet(0);
    expect(kcalInput().value).toBe('');
  });
});
