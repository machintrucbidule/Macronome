import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { DayTone, Verdict } from '@macronome/shared';
import { VerdictBadge, type VerdictLabels } from './VerdictBadge';
import styles from './VerdictBadge.module.css';

// B-166 + B-262: the badge renders the SERVER tone verbatim (spec/logic/day-snapshot-verdict.md
// §8b) — `warn` is the NOK-but-still-under-the-burn case that used to be derived here from
// `belowBurn`. The derivation itself now has domain oracles (api day-verdict.test.ts); what is
// asserted here is that the badge never second-guesses the value it is handed.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const labels: VerdictLabels = {
  forceOk: 'Forcer OK',
  forceNok: 'Forcer NOK',
  autoCalc: (a) => (a ? `Calcul auto (${a})` : 'Calcul auto'),
  auto: 'auto',
  forced: 'forcé',
};

function renderBadge(effective: Verdict | null, tone: DayTone) {
  return render(
    <VerdictBadge
      effective={effective}
      auto={effective}
      override={null}
      labels={labels}
      onSet={vi.fn()}
      tone={tone}
    />,
  );
}

const badge = (c: HTMLElement): HTMLElement => c.querySelector('button') as HTMLElement;

describe('VerdictBadge renders the server tone (B-166 / B-262)', () => {
  it('is orange (.warn) on tone=warn — NOK but still under the burn', () => {
    const { container } = renderBadge('NOK', 'warn');
    expect(badge(container).className).toContain(styles.warn);
    expect(badge(container).className).not.toContain(styles.nok);
  });

  it('is red (.nok) on tone=nok — over the burn, or the burn is unknown', () => {
    const { container } = renderBadge('NOK', 'nok');
    expect(badge(container).className).toContain(styles.nok);
    expect(badge(container).className).not.toContain(styles.warn);
  });

  it('is green (.ok) on tone=ok', () => {
    const { container } = renderBadge('OK', 'ok');
    expect(badge(container).className).toContain(styles.ok);
    expect(badge(container).className).not.toContain(styles.warn);
  });

  it('renders the muted dash when there is no effective verdict at all', () => {
    const { container } = renderBadge(null, 'none');
    expect(container.querySelector('button')).toBeNull();
    expect(container.textContent).toBe('—');
  });
});
