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

// B-086: on a Partiel (summary) day only kcal is meaningful, so each macro card keeps its
// title + target but shows "—" instead of "0 g", drops the status word, and hides the bar.
describe('MacroCard muted (B-086)', () => {
  it('renders "—", no status word, and no bar when muted', () => {
    const { container } = render(
      <MacroCard
        label="Lipides"
        value={0}
        threshold={50}
        mode="floor"
        thresholdText={i18n.t('meals.card.min', { n: formatInt(50) })}
        status={{ ok: i18n.t('meals.status.ok'), bad: i18n.t('meals.status.sous') }}
        unit="g"
        muted
      />,
    );
    const text = container.textContent ?? '';
    expect(text).toContain('—'); // no value on a Partiel day
    expect(text).toContain('min. 50 g'); // target kept
    expect(text).not.toContain(i18n.t('meals.status.sous')); // status word dropped
    // bar (the threshold track) is hidden — only label + target + value spans remain
    const spans = [...container.querySelectorAll('span')];
    expect(spans.length).toBe(3);
    expect(spans[2]?.textContent).toBe('—'); // the value span shows just the em-dash
  });
});
