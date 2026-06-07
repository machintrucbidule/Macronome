import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { CalorieCard } from './CalorieCard';

// DK-1 / B-079: the Repas calorie card is editable on a Partiel day (writes summary_kcal),
// read-only on a Complet day. Labels/status are passed in, so no i18n is needed here.
const STATUS = { inBand: 'OK', under: 'Below', over: 'Over' };

afterEach(cleanup);

function renderCard(props: Partial<Parameters<typeof CalorieCard>[0]> = {}) {
  return render(
    <CalorieCard
      label="Calories"
      value={1800}
      min={1900}
      max={2100}
      thresholdText="cible 1900–2100"
      status={STATUS}
      unit="kcal"
      {...props}
    />,
  );
}

describe('CalorieCard editable (DK-1 / B-079)', () => {
  it('is read-only by default (no input)', () => {
    const { container } = renderCard();
    expect(container.querySelector('input')).toBeNull();
    expect(container.textContent).toContain('1800');
  });

  it('renders an input and writes summary_kcal on commit when editable', () => {
    const onSave = vi.fn();
    const { container } = renderCard({ editable: true, onSave });
    const input = container.querySelector('input') as HTMLInputElement;
    expect(input).toBeTruthy();
    fireEvent.change(input, { target: { value: '2000' } });
    fireEvent.blur(input);
    expect(onSave).toHaveBeenCalledWith(2000);
  });

  it('does not call onSave when the value is unchanged or invalid', () => {
    const onSave = vi.fn();
    const { container } = renderCard({ value: 2000, editable: true, onSave });
    const input = container.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2000' } }); // unchanged
    fireEvent.blur(input);
    fireEvent.change(input, { target: { value: '' } }); // invalid
    fireEvent.blur(input);
    expect(onSave).not.toHaveBeenCalled();
  });
});
