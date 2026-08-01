import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { CaloriesCell } from './CaloriesCell';

// B-250: an editable kcal field is seeded at display precision (integer kcal, per
// spec/logic/00-conventions.md §Rounding) — the server keeps the exact derived sum.
afterEach(cleanup);

function renderCell(kcal: number, editable: boolean) {
  return render(
    <table>
      <tbody>
        <tr>
          <CaloriesCell
            kcal={kcal}
            editable={editable}
            placeholder="kcal"
            onOpen={vi.fn()}
            onSave={vi.fn()}
          />
        </tr>
      </tbody>
    </table>,
  );
}

describe('CaloriesCell seeding (B-250)', () => {
  it('seeds the editable input with the integer kcal, not the raw sum', () => {
    const { container } = renderCell(1873.45, true);
    expect((container.querySelector('input') as HTMLInputElement).value).toBe('1873');
  });

  it('leaves the input empty on a day with no calories', () => {
    const { container } = renderCell(0, true);
    expect((container.querySelector('input') as HTMLInputElement).value).toBe('');
  });

  it('still shows the rounded read-only total on a detailed day', () => {
    const { container } = renderCell(1873.45, false);
    expect(container.querySelector('input')).toBeNull();
    expect(container.textContent).toBe('1873');
  });
});
