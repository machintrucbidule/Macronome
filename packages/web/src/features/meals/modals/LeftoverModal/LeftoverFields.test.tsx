import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import i18n from '../../../../i18n/config';
import { LeftoverFields } from './LeftoverFields';

// B-027: the leftover container picker is wired to the real tare catalog (it was a disabled
// "Rien"-only stub). It lists every container (incl. the built-in "Rien", 0 g) and selecting
// one bubbles its id up so the parent can recompute the net from its tare. (B-047 moved the
// option list to a pre-built `options` prop so the form can inject a frozen-container option.)
afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('fr');
});

const OPTIONS = [
  { value: 'rien', label: 'Rien (0 g)' },
  { value: 'bol', label: 'Bol (250 g)' },
];

describe('LeftoverFields container picker (B-027)', () => {
  it('lists every container (incl. "Rien") and is not disabled', () => {
    const { getByTestId } = render(
      <LeftoverFields
        fieldId="f"
        gross="500"
        onGross={() => {}}
        net={500}
        options={OPTIONS}
        containerId="rien"
        onContainer={() => {}}
      />,
    );
    const select = getByTestId('lo-container') as HTMLSelectElement;
    expect(select.disabled).toBe(false);
    const options = [...select.options].map((o) => o.textContent);
    expect(options).toEqual(['Rien (0 g)', 'Bol (250 g)']);
    expect(select.value).toBe('rien');
  });

  it('reports the chosen container id on change', () => {
    const onContainer = vi.fn();
    const { getByTestId } = render(
      <LeftoverFields
        fieldId="f"
        gross="500"
        onGross={() => {}}
        net={500}
        options={OPTIONS}
        containerId="rien"
        onContainer={onContainer}
      />,
    );
    fireEvent.change(getByTestId('lo-container'), { target: { value: 'bol' } });
    expect(onContainer).toHaveBeenCalledWith('bol');
  });
});
