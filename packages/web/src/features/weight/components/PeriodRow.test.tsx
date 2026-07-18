import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { Period } from '@macronome/shared';
import '../../../i18n/config';
import { PeriodRow } from './PeriodRow';

// B-225: the 📋 recap button lives in its own cell and must stopPropagation so it never triggers
// the row's edit-on-click. Clicking anywhere else on the row still opens the edit.
afterEach(() => cleanup());

function period(): Period {
  return {
    start_date: '2026-01-01',
    end_date: '2026-01-08',
    days: 7,
    weight_end: 80,
    ema: 80,
    delta: -1,
    ecart_trajectoire: 0,
    bmi: 24,
    waist: null,
    avg_intake: 2000,
    estimated_burn: 2100,
    empirical_burn: 2100,
    deficit_per_day: -100,
    avg_activity: 1.2,
    diet_flag: 'in_diet',
    note: null,
    open: false,
  };
}

function renderRow() {
  const onClick = vi.fn();
  const onRecap = vi.fn();
  const utils = render(
    <table>
      <tbody>
        <PeriodRow period={period()} onClick={onClick} onRecap={onRecap} />
      </tbody>
    </table>,
  );
  return { ...utils, onClick, onRecap };
}

describe('PeriodRow interval-days button (B-225)', () => {
  it('opens the recap without triggering the row edit (stopPropagation)', () => {
    const { getByRole, onClick, onRecap } = renderRow();
    fireEvent.click(getByRole('button')); // the only button in the row is the 📋 recap button
    expect(onRecap).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('opens the edit when clicking elsewhere on the row', () => {
    const { container, onClick } = renderRow();
    const periodCell = container.querySelector('td');
    fireEvent.click(periodCell as HTMLElement);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
