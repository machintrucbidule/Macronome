import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { JournalRow as Row } from '@macronome/shared';
import i18n from '../../../i18n/config';
import { JournalCard } from './JournalCard';
import styles from '../journal-mobile.module.css';

// B-166 + B-262: the mobile card's static verdict pill renders the SERVER tone verbatim — the
// deficit sub-tone (orange when intake ≤ burn) is decided by the API, not re-derived here from
// burn_gap. These cases mirror the domain oracles in day-verdict.test.ts.
afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('fr');
  vi.restoreAllMocks();
});

function row(verdict: Row['effective_verdict'], tone: Row['tone']): Row {
  return {
    date: '2026-01-01',
    kcal: 2200,
    macros: null,
    verdict_auto: verdict,
    verdict_override: null,
    effective_verdict: verdict,
    kcal_gap: null,
    burn_gap: null,
    activity_level: 'sedentary',
    comment: null,
    kind: 'detailed',
    state: 'green',
    tone,
    editable_kcal: false,
  };
}

function pill(verdict: Row['effective_verdict'], tone: Row['tone']): HTMLElement {
  const { container } = render(<JournalCard row={row(verdict, tone)} onOpen={vi.fn()} />);
  return container.querySelector(`.${styles.badge}`) as HTMLElement;
}

describe('JournalCard verdict pill renders the server tone (B-166 / B-262)', () => {
  it('is orange on tone=warn (NOK but still under the burn)', () => {
    expect(pill('NOK', 'warn').className).toContain(styles.badgeWarn);
  });

  it('is red on tone=nok (over the burn, or the burn is unknown)', () => {
    const el = pill('NOK', 'nok');
    expect(el.className).toContain(styles.badgeNok);
    expect(el.className).not.toContain(styles.badgeWarn);
  });

  it('is green on tone=ok', () => {
    const el = pill('OK', 'ok');
    expect(el.className).toContain(styles.badgeOk);
    expect(el.className).not.toContain(styles.badgeWarn);
  });

  it('stays muted when the day carries no verdict, whatever the tone', () => {
    expect(pill(null, 'none').className).toContain(styles.badgeMuted);
  });
});
