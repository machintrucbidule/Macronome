import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import i18n from '../../../../i18n/config';
import { LeftoverFields } from './LeftoverFields';

// B-027: the leftover container picker is wired to the real tare catalog (it was a disabled
// "Rien"-only stub). It lists every container (incl. the built-in "Rien", 0 g) and selecting
// one bubbles its id up so the parent can recompute the net from its tare. (B-047 moved the
// option list to a pre-built `options` prop so the form can inject a frozen-container option.)
// FORM-1: the native <select> became SelectMenu in its field variant (forms-inputs.md §Select),
// so the picker is now a trigger button + a listbox panel rather than a <select>/<option> pair.
afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('fr');
});

const OPTIONS = [
  { value: 'rien', label: 'Rien (0 g)' },
  { value: 'bol', label: 'Bol (250 g)' },
];

const props = {
  fieldId: 'f',
  gross: '500',
  onGross: () => {},
  net: 500,
  options: OPTIONS,
  containerId: 'rien',
};

describe('LeftoverFields container picker (B-027)', () => {
  it('lists every container (incl. "Rien") and is not disabled', () => {
    const { getByTestId, getAllByRole } = render(
      <LeftoverFields {...props} onContainer={() => {}} />,
    );
    const trigger = getByTestId('lo-container') as HTMLButtonElement;
    expect(trigger.disabled).toBe(false);
    expect(trigger.textContent).toContain('Rien (0 g)'); // the current value

    fireEvent.click(trigger);
    const options = getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['Rien (0 g)', 'Bol (250 g)']);
  });

  it('reports the chosen container id on change', () => {
    const onContainer = vi.fn();
    const { getByTestId, getByRole } = render(
      <LeftoverFields {...props} onContainer={onContainer} />,
    );
    fireEvent.click(getByTestId('lo-container'));
    fireEvent.click(getByRole('option', { name: 'Bol (250 g)' }));
    expect(onContainer).toHaveBeenCalledWith('bol');
  });

  it('keeps the gross weight on the numeric keypad (B-270)', () => {
    const { getByTestId } = render(<LeftoverFields {...props} onContainer={() => {}} />);
    expect(getByTestId('lo-gross').getAttribute('inputmode')).toBe('decimal');
  });
});
