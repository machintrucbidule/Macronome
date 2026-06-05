import { afterEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import i18n from '../../i18n/config';
import { formatInt } from '../../lib/format/number';
import { MacroCard } from './MacroCard';

// B-019: macro amounts and target thresholds render as integers (no raw float like
// "max. 135.29999999999998 g"). MacroCard is a pure presentational component; the
// threshold text is built exactly as TotalsRow builds it (via i18n + formatInt).
afterEach(async () => {
  await i18n.changeLanguage('fr');
});

describe('MacroCard (B-019)', () => {
  const FLOAT = 135.29999999999998;

  it('renders the value and threshold as integers, never a raw float', () => {
    const { container } = render(
      <MacroCard
        label="Glucides"
        value={FLOAT}
        threshold={FLOAT}
        mode="ceiling"
        thresholdText={i18n.t('meals.card.max', { n: formatInt(FLOAT) })}
        status={{ ok: 'OK', bad: 'Dépassé' }}
        unit="g"
      />,
    );

    const text = container.textContent ?? '';
    expect(text).toContain('135 g'); // value
    expect(text).toContain('max. 135 g'); // threshold
    expect(text).not.toContain('135.2');
    expect(text).not.toContain('135,2');
  });
});
