import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { Verdict } from '@macronome/shared';
import { VerdictBadge, type VerdictLabels } from './VerdictBadge';
import styles from './VerdictBadge.module.css';

// B-166: a NOK verdict badge is orange (.warn) when the day is still in a deficit (belowBurn === true),
// red (.nok) on a surplus or unknown burn (false/null), and OK stays green (.ok) regardless.
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

function renderBadge(effective: Verdict | null, belowBurn?: boolean | null) {
  return render(
    <VerdictBadge
      effective={effective}
      auto={effective}
      override={null}
      labels={labels}
      onSet={vi.fn()}
      belowBurn={belowBurn}
    />,
  );
}

const badge = (c: HTMLElement): HTMLElement => c.querySelector('button') as HTMLElement;

describe('VerdictBadge NOK deficit sub-tone (B-166)', () => {
  it('is orange (.warn) when NOK and the day is in a deficit', () => {
    const { container } = renderBadge('NOK', true);
    expect(badge(container).className).toContain(styles.warn);
    expect(badge(container).className).not.toContain(styles.nok);
  });

  it('is red (.nok) when NOK and the day is in a surplus', () => {
    const { container } = renderBadge('NOK', false);
    expect(badge(container).className).toContain(styles.nok);
    expect(badge(container).className).not.toContain(styles.warn);
  });

  it('is red (.nok) when NOK and the burn is unknown (belowBurn null)', () => {
    const { container } = renderBadge('NOK', null);
    expect(badge(container).className).toContain(styles.nok);
    expect(badge(container).className).not.toContain(styles.warn);
  });

  it('is red (.nok) when NOK and belowBurn is not provided', () => {
    const { container } = renderBadge('NOK');
    expect(badge(container).className).toContain(styles.nok);
  });

  it('stays green (.ok) when OK, whatever belowBurn is', () => {
    for (const b of [true, false, null] as const) {
      const { container } = renderBadge('OK', b);
      expect(badge(container).className).toContain(styles.ok);
      expect(badge(container).className).not.toContain(styles.warn);
      cleanup();
    }
  });
});
