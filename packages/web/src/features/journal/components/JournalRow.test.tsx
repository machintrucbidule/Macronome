import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { DayState, JournalRow as Row } from '@macronome/shared';
import i18n from '../../../i18n/config';
import { formatInt } from '../../../lib/format/number';
import { JournalRow } from './JournalRow';
import { JournalLegend } from './JournalLegend';
import styles from '../journal.module.css';
import badgeStyles from '../../../components/VerdictBadge/VerdictBadge.module.css';

// JR-1 / B-077: every Journal row carries a left state band — green Complet, yellow Partiel,
// red Rien; none (future empty) shows no band. Plus a 3-item state legend by the year selector.
afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('fr');
  vi.restoreAllMocks();
});

function row(state: DayState, gap: number | null = null, burnGap: number | null = null): Row {
  return {
    date: '2026-01-01',
    kcal: 0,
    macros: null,
    verdict_auto: null,
    verdict_override: null,
    effective_verdict: null,
    kcal_gap: gap,
    burn_gap: burnGap,
    activity_level: 'sedentary',
    comment: null,
    kind: state === 'green' ? 'detailed' : state === 'yellow' ? 'summary' : null,
    state,
    // These cases exercise the band + the écarts, not the badge; no verdict → no tone (§8b).
    tone: 'none',
    editable_kcal: false,
  };
}

function renderRow(state: DayState, gap: number | null = null, burnGap: number | null = null) {
  return render(
    <MemoryRouter>
      <table>
        <tbody>
          <JournalRow row={row(state, gap, burnGap)} onPatch={vi.fn()} />
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

describe('JournalRow kcal écart (B-138)', () => {
  it('shows a green negative écart at/under cal_max, including an in-band OK day', () => {
    const { container } = renderRow('green', -100); // 2000 − 2100 on an OK day
    const gap = container.querySelector(`.${styles.gap}`) as HTMLElement;
    expect(gap.textContent).toBe('−100');
    expect(gap.className).toContain(styles.gapUnder);
  });

  it('shows a red positive écart when over cal_max', () => {
    const { container } = renderRow('green', 300);
    const gap = container.querySelector(`.${styles.gap}`) as HTMLElement;
    expect(gap.textContent).toBe('+300');
    expect(gap.className).toContain(styles.gapOver);
  });

  it('shows no écart when the server omits it (red/empty day, kcal_gap null)', () => {
    const { container } = renderRow('red', null);
    expect(container.querySelector(`.${styles.gap}`)).toBeNull();
  });
});

describe('JournalRow burn écart vs estimated expenditure (B-163)', () => {
  const burnGapEl = (container: HTMLElement): HTMLElement | null =>
    container.querySelector(`.${styles.activityCell} .${styles.gap}`);

  it('shows a green negative écart when intake is under the estimated burn', () => {
    const { container } = renderRow('green', null, -288);
    const gap = burnGapEl(container) as HTMLElement;
    expect(gap.textContent).toBe('−288');
    expect(gap.className).toContain(styles.gapUnder);
  });

  it('shows a red positive écart when intake is over the estimated burn', () => {
    const { container } = renderRow('green', null, 312);
    const gap = burnGapEl(container) as HTMLElement;
    expect(gap.textContent).toBe('+312');
    expect(gap.className).toContain(styles.gapOver);
  });

  it('shows no burn écart when the server omits it (no weigh-in, burn_gap null)', () => {
    const { container } = renderRow('green', null, null);
    expect(burnGapEl(container)).toBeNull();
  });
});

describe('JournalRow écart hover tooltips (JT-1 / B-164)', () => {
  const tip = (container: HTMLElement, scope = ''): HTMLElement | null =>
    container.querySelector(`${scope}[role="tooltip"]`);

  it('explains the target écart: above the target when positive', () => {
    const { container } = renderRow('green', 300);
    expect(tip(container)!.textContent).toBe(
      i18n.t('journal.gap.targetOver', { n: formatInt(300) }),
    );
  });

  it('explains the target écart: below the target when negative', () => {
    const { container } = renderRow('green', -100);
    expect(tip(container)!.textContent).toBe(
      i18n.t('journal.gap.targetUnder', { n: formatInt(100) }),
    );
  });

  it('explains the expenditure écart: above the estimated burn when positive', () => {
    const { container } = renderRow('green', null, 312);
    expect(tip(container, `.${styles.activityCell} `)!.textContent).toBe(
      i18n.t('journal.gap.burnOver', { n: formatInt(312) }),
    );
  });

  it('explains the expenditure écart: below the estimated burn when negative', () => {
    const { container } = renderRow('green', null, -288);
    expect(tip(container, `.${styles.activityCell} `)!.textContent).toBe(
      i18n.t('journal.gap.burnUnder', { n: formatInt(288) }),
    );
  });

  it('renders no tooltip when both écarts are null', () => {
    const { container } = renderRow('red', null, null);
    expect(tip(container)).toBeNull();
  });
});

// B-262: the row hands the badge the SERVER tone; it no longer derives the sub-tone from
// burn_gap. The derivation's own oracles live in the api domain tests (day-verdict.test.ts).
describe('JournalRow verdict badge renders the server tone (B-166 / B-262)', () => {
  function renderVerdict(verdict: 'OK' | 'NOK', tone: Row['tone']) {
    const r: Row = {
      ...row('green', null, null),
      effective_verdict: verdict,
      verdict_auto: verdict,
      tone,
    };
    return render(
      <MemoryRouter>
        <table>
          <tbody>
            <JournalRow row={r} onPatch={vi.fn()} />
          </tbody>
        </table>
      </MemoryRouter>,
    );
  }
  const badge = (c: HTMLElement): HTMLElement =>
    c.querySelector(`.${styles.badgeSlot} button`) as HTMLElement;

  it('is orange on tone=warn (NOK but still under the burn)', () => {
    const { container } = renderVerdict('NOK', 'warn');
    expect(badge(container).className).toContain(badgeStyles.warn);
  });

  it('is red on tone=nok (over the burn, or the burn is unknown)', () => {
    const { container } = renderVerdict('NOK', 'nok');
    expect(badge(container).className).toContain(badgeStyles.nok);
    expect(badge(container).className).not.toContain(badgeStyles.warn);
  });

  it('is green on tone=ok', () => {
    const { container } = renderVerdict('OK', 'ok');
    expect(badge(container).className).toContain(badgeStyles.ok);
    expect(badge(container).className).not.toContain(badgeStyles.warn);
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
