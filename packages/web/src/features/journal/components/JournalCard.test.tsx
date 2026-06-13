import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { JournalRow as Row } from '@macronome/shared';
import i18n from '../../../i18n/config';
import { JournalCard } from './JournalCard';
import styles from '../journal-mobile.module.css';

// B-166: the mobile card's static verdict pill follows the same deficit sub-tone as the shared
// badge — NOK is orange (.badgeWarn) when intake ≤ burn (burn_gap ≤ 0), red otherwise / unknown.
afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('fr');
  vi.restoreAllMocks();
});

function row(verdict: Row['effective_verdict'], burnGap: number | null): Row {
  return {
    date: '2026-01-01',
    kcal: 2200,
    macros: null,
    verdict_auto: verdict,
    verdict_override: null,
    effective_verdict: verdict,
    kcal_gap: null,
    burn_gap: burnGap,
    activity_level: 'sedentary',
    comment: null,
    kind: 'detailed',
    state: 'green',
    editable_kcal: false,
  };
}

function pill(verdict: Row['effective_verdict'], burnGap: number | null): HTMLElement {
  const { container } = render(<JournalCard row={row(verdict, burnGap)} onOpen={vi.fn()} />);
  return container.querySelector(`.${styles.badge}`) as HTMLElement;
}

describe('JournalCard verdict pill deficit sub-tone (B-166)', () => {
  it('is orange when NOK and in a deficit (burn_gap ≤ 0)', () => {
    expect(pill('NOK', -288).className).toContain(styles.badgeWarn);
  });

  it('is red when NOK and in a surplus (burn_gap > 0)', () => {
    const el = pill('NOK', 312);
    expect(el.className).toContain(styles.badgeNok);
    expect(el.className).not.toContain(styles.badgeWarn);
  });

  it('is red when NOK and the burn is unknown (burn_gap null)', () => {
    const el = pill('NOK', null);
    expect(el.className).toContain(styles.badgeNok);
    expect(el.className).not.toContain(styles.badgeWarn);
  });

  it('stays green when OK regardless of the deficit', () => {
    const el = pill('OK', -288);
    expect(el.className).toContain(styles.badgeOk);
    expect(el.className).not.toContain(styles.badgeWarn);
  });
});
