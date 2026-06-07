import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { DayState, JournalRow as Row } from '@macronome/shared';
import i18n from '../../../i18n/config';
import { JournalRow } from './JournalRow';
import { JournalLegend } from './JournalLegend';
import styles from '../journal.module.css';

// JR-1 / B-077: every Journal row carries a left state band — green Complet, yellow Partiel,
// red Rien; none (future empty) shows no band. Plus a 3-item state legend by the year selector.
afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('fr');
  vi.restoreAllMocks();
});

function row(state: DayState): Row {
  return {
    date: '2026-01-01',
    kcal: 0,
    macros: null,
    verdict_auto: null,
    verdict_override: null,
    effective_verdict: null,
    activity_level: 'sedentary',
    comment: null,
    kind: state === 'green' ? 'detailed' : state === 'yellow' ? 'summary' : null,
    state,
    editable_kcal: false,
  };
}

function renderRow(state: DayState) {
  return render(
    <MemoryRouter>
      <table>
        <tbody>
          <JournalRow row={row(state)} onPatch={vi.fn()} />
        </tbody>
      </table>
    </MemoryRouter>,
  );
}

describe('JournalRow state band (JR-1 / B-077)', () => {
  it('applies the green band class on a Complet day', () => {
    const { container } = renderRow('green');
    expect((container.querySelector('tr') as HTMLElement).className).toBe(styles.detailedRow);
  });

  it('applies the yellow band class on a Partiel day', () => {
    const { container } = renderRow('yellow');
    expect((container.querySelector('tr') as HTMLElement).className).toBe(styles.summaryRow);
  });

  it('applies the red band class on a Rien day', () => {
    const { container } = renderRow('red');
    expect((container.querySelector('tr') as HTMLElement).className).toBe(styles.emptyRow);
  });

  it('applies no band class on a future-empty (none) day', () => {
    const { container } = renderRow('none');
    expect((container.querySelector('tr') as HTMLElement).className).toBe('');
  });
});

describe('JournalLegend (JR-1 / B-077)', () => {
  it('renders the three state labels', () => {
    const { container } = render(<JournalLegend />);
    const text = container.textContent ?? '';
    expect(text).toContain(i18n.t('journal.legend.green'));
    expect(text).toContain(i18n.t('journal.legend.yellow'));
    expect(text).toContain(i18n.t('journal.legend.red'));
  });
});
