import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { NumberInput } from './NumberInput';

// B-006: the custom ▲▼ stepper steps the value by `step`, clamped to min/max, and reports
// the new value through onChange (the controlled parent reads e.target.value).
afterEach(cleanup);

function arrows(container: HTMLElement): { up: HTMLButtonElement; down: HTMLButtonElement } {
  const btns = container.querySelectorAll('button');
  return { up: btns[0] as HTMLButtonElement, down: btns[1] as HTMLButtonElement };
}

/** The value reported by the nth onChange call (consumers read e.target.value). */
function nthValue(onChange: Mock, n: number): string | undefined {
  const arg = onChange.mock.calls[n]?.[0] as { target: { value: string } } | undefined;
  return arg?.target.value;
}

describe('NumberInput stepper (B-006)', () => {
  it('▲ adds one step, ▼ subtracts one step', () => {
    const onChange = vi.fn();
    const { container } = render(
      <NumberInput suffix="kcal" value="1550" step={10} onChange={onChange} />,
    );
    const { up, down } = arrows(container);
    fireEvent.click(up);
    expect(nthValue(onChange, 0)).toBe('1560');
    fireEvent.click(down);
    expect(nthValue(onChange, 1)).toBe('1540');
  });

  it('respects a decimal step and trims float noise', () => {
    const onChange = vi.fn();
    const { container } = render(
      <NumberInput suffix="g/kg" value="1.9" step={0.1} onChange={onChange} />,
    );
    fireEvent.click(arrows(container).up);
    expect(nthValue(onChange, 0)).toBe('2.0');
  });

  it('clamps to max (and to min)', () => {
    const onChange = vi.fn();
    const { container, rerender } = render(
      <NumberInput value="100" step={5} min={0} max={100} onChange={onChange} />,
    );
    fireEvent.click(arrows(container).up);
    expect(nthValue(onChange, 0)).toBe('100'); // capped at max

    rerender(<NumberInput value="0" step={5} min={0} max={100} onChange={onChange} />);
    fireEvent.click(arrows(container).down);
    expect(nthValue(onChange, 1)).toBe('0'); // floored at min
  });

  it('treats an empty value as 0', () => {
    const onChange = vi.fn();
    const { container } = render(<NumberInput value="" step={1} onChange={onChange} />);
    fireEvent.click(arrows(container).up);
    expect(nthValue(onChange, 0)).toBe('1');
  });
});
