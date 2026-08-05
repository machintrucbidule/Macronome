import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { SelectMenu } from './SelectMenu';

// FORM-1: the five native <select> form fields moved onto SelectMenu (forms-inputs.md §Select).
// A native select gives keyboard navigation, a placeholder and a disabled state for free — these
// cover the replacements, so the migration is not a regression for keyboard users.
afterEach(cleanup);

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Bravo' },
  { value: 'c', label: 'Charlie' },
];

const setup = (props: Partial<Parameters<typeof SelectMenu<string>>[0]> = {}) => {
  const onChange = vi.fn();
  const view = render(
    <SelectMenu
      variant="field"
      value="a"
      options={OPTIONS}
      onChange={onChange}
      data-testid="sel"
      {...props}
    />,
  );
  return { ...view, onChange, trigger: view.getByTestId('sel') as HTMLButtonElement };
};

describe('SelectMenu field variant', () => {
  it('shows the placeholder when the value matches no option', () => {
    const { trigger } = setup({ value: '', placeholder: 'Choisir…' });
    expect(trigger.textContent).toContain('Choisir…');
  });

  it('falls back to the current option label when there is a match', () => {
    const { trigger } = setup();
    expect(trigger.textContent).toContain('Alpha');
  });

  it('does not open when disabled', () => {
    const { trigger, queryByRole } = setup({ disabled: true });
    expect(trigger.disabled).toBe(true);
    fireEvent.click(trigger);
    expect(queryByRole('listbox')).toBeNull();
  });
});

describe('SelectMenu keyboard navigation', () => {
  it('opens on ArrowDown at the selected option and commits on Enter', () => {
    const { trigger, onChange } = setup({ value: 'b' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    // Opens highlighting the current value ("Bravo"), then moves down to "Charlie".
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('c');
  });

  it('stops at the last option instead of wrapping', () => {
    const { trigger, onChange } = setup({ value: 'c' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('c');
  });

  it('jumps to the first and last option with Home and End', () => {
    const { trigger, onChange } = setup({ value: 'b' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'End' });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('c');

    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'Home' });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith('a');
  });

  it('announces the highlighted option and closes on Escape, returning focus', () => {
    const { trigger, queryByRole } = setup();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(queryByRole('listbox')).not.toBeNull();
    expect(trigger.getAttribute('aria-activedescendant')).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
