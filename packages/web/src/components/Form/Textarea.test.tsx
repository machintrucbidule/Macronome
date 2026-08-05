import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { Textarea } from './Textarea';

// FORM-1: the app's seven textareas carried four divergent recipes and three had no focus state.
// They now share this primitive (design/components/forms-inputs.md §Textarea).
afterEach(cleanup);

describe('Textarea', () => {
  it('renders a bare control when there is no label', () => {
    const { container } = render(<Textarea aria-label="Notes" />);
    expect(container.querySelector('label')).toBeNull();
    expect(container.querySelector('textarea')).not.toBeNull();
  });

  it('wraps the control in a label when one is given', () => {
    const { container, getByText } = render(<Textarea label="Instructions" />);
    const label = container.querySelector('label');
    expect(label).not.toBeNull();
    expect(getByText('Instructions')).toBeTruthy();
    expect(label?.querySelector('textarea')).not.toBeNull();
  });

  it('shows the counter only when asked and a maxLength is set', () => {
    const { queryByText, rerender } = render(
      <Textarea counter maxLength={500} value="abc" onChange={() => {}} />,
    );
    expect(queryByText('3 / 500')).toBeTruthy();

    rerender(<Textarea maxLength={500} value="abc" onChange={() => {}} />);
    expect(queryByText('3 / 500')).toBeNull();

    rerender(<Textarea counter value="abc" onChange={() => {}} />);
    expect(queryByText(/\/ 500/)).toBeNull();
  });

  it('marks the field invalid for assistive tech', () => {
    const { container } = render(<Textarea invalid aria-label="Notes" />);
    expect(container.querySelector('textarea')?.getAttribute('aria-invalid')).toBe('true');
  });

  it('applies the mono variant on top of the base class', () => {
    const { container } = render(<Textarea mono aria-label="Prompt" />);
    const cls = container.querySelector('textarea')?.className ?? '';
    expect(cls.split(' ').length).toBeGreaterThan(1);
  });
});
