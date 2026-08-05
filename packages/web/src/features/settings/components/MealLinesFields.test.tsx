import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18n from '../../../i18n/config';
import { MealLinesFields } from './MealLinesFields';

// B-244 adds the minimum-columns stepper beside the two B-203 line floors, and all three now
// share one edit rule (useNumberSetting): an in-range value saves immediately (the ▲▼ stepper),
// blur clamps an out-of-range one. A line field is asserted too, so the extraction of that rule
// out of this component is shown to have changed nothing.
const mocks = vi.hoisted(() => ({
  save: { mutate: vi.fn() },
  settings: {
    data: { data: { lines_desktop: 20, lines_mobile: 15, min_meal_columns: 4 } },
  },
}));

vi.mock('../useSettings', () => ({
  useSettingsQuery: () => mocks.settings,
  useSettingsMutation: () => mocks.save,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const columnsLabel = (): string => i18n.t('settings.template.minColumns');
const linesLabel = (): string => i18n.t('settings.template.linesDesktop');

describe('MealLinesFields — minimum meal columns (B-244)', () => {
  it('shows the stored value with the 1..6 bounds', () => {
    render(<MealLinesFields />);
    const input = screen.getByLabelText<HTMLInputElement>(columnsLabel());
    expect(input.value).toBe('4');
    expect(input.min).toBe('1');
    expect(input.max).toBe('6');
  });

  it('saves an in-range value immediately', () => {
    render(<MealLinesFields />);
    fireEvent.change(screen.getByLabelText(columnsLabel()), { target: { value: '5' } });
    expect(mocks.save.mutate).toHaveBeenCalledWith({ min_meal_columns: 5 });
  });

  it('does not save while the typed value is out of range, and clamps it on blur', () => {
    render(<MealLinesFields />);
    const input = screen.getByLabelText<HTMLInputElement>(columnsLabel());
    fireEvent.change(input, { target: { value: '9' } });
    expect(mocks.save.mutate).not.toHaveBeenCalled();

    fireEvent.blur(input);
    expect(input.value).toBe('6');
    expect(mocks.save.mutate).toHaveBeenCalledWith({ min_meal_columns: 6 });
  });

  // B-270: an integer call site of the shared NumberInput — a whole number of lines/columns, so
  // the phone gets the plain numeric pad (the decimal one is derived for fractional fields).
  it('opens the plain numeric keypad on a phone', () => {
    render(<MealLinesFields />);
    expect(screen.getByLabelText(columnsLabel()).getAttribute('inputmode')).toBe('numeric');
    expect(screen.getByLabelText(linesLabel()).getAttribute('inputmode')).toBe('numeric');
  });

  it('applies the same rule to the line floors (5..50), unchanged by the extraction', () => {
    render(<MealLinesFields />);
    const input = screen.getByLabelText<HTMLInputElement>(linesLabel());
    expect(input.value).toBe('20');

    fireEvent.change(input, { target: { value: '25' } });
    expect(mocks.save.mutate).toHaveBeenCalledWith({ lines_desktop: 25 });

    fireEvent.change(input, { target: { value: '1' } });
    fireEvent.blur(input);
    expect(input.value).toBe('5');
    expect(mocks.save.mutate).toHaveBeenCalledWith({ lines_desktop: 5 });
  });
});
