import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import i18n from '../../../../i18n/config';
import { ActivityHelp } from './ActivityHelp';

// B-026 rework: the legend lists a daily-activity example per level and the kcal/day FROM
// ACTIVITY (above BMR, server-computed); kcal is hidden when there is no weigh-in.
afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('fr');
});

function open(node: HTMLElement): void {
  fireEvent.click(node.querySelector('button') as HTMLButtonElement);
}

describe('ActivityHelp (B-026)', () => {
  it('shows a daily example and per-level activity kcal when a weigh-in exists', () => {
    const { container } = render(
      <ActivityHelp
        perLevelBurn={{
          sedentary: 346,
          lightly_active: 649,
          moderately_active: 952,
          very_active: 1254,
          extremely_active: 1557,
        }}
      />,
    );
    open(container);
    const text = container.textContent ?? '';
    expect(text).toContain('346'); // sedentary activity kcal
    expect(text).toContain('kcal/j'); // the per-level kcal line
    expect(text).toContain('5 000 pas'); // a real daily-activity example (not weekly frequency)
    expect(text).not.toContain('j/sem'); // the old weekly-frequency wording is gone
  });

  it('hides kcal when there is no weigh-in (perLevelBurn null)', () => {
    const { container } = render(<ActivityHelp perLevelBurn={null} />);
    open(container);
    const text = container.textContent ?? '';
    expect(text).toContain('5 000 pas'); // examples still shown
    expect(text).not.toContain('kcal/j'); // but no calories
  });
});
