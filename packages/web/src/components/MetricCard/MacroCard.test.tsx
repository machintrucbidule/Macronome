import { afterEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import i18n from '../../i18n/config';
import { formatInt } from '../../lib/format/number';
import { MacroCard } from './MacroCard';
import styles from './BandCard.module.css';

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

// B-139: each macro card shows the signed écart vs its threshold below the status word — floor
// (protein/fat): below red / at-or-above green; ceiling (carb): below green / above red.
describe('MacroCard écart (B-139)', () => {
  const STATUS = { ok: 'OK', bad: 'NOK' };
  function card(props: Partial<Parameters<typeof MacroCard>[0]>) {
    return render(
      <MacroCard
        label="M"
        value={0}
        threshold={60}
        mode="floor"
        thresholdText="t"
        status={STATUS}
        unit="g"
        {...props}
      />,
    );
  }
  const ecart = (c: HTMLElement): HTMLElement => c.querySelector(`.${styles.ecart}`) as HTMLElement;

  it('floor below threshold → red negative écart', () => {
    const { container } = card({ value: 40, threshold: 60, mode: 'floor' });
    expect(ecart(container).textContent).toBe('−20');
    expect(ecart(container).className).toContain(styles.ecartBad);
  });

  it('floor at or above threshold → green positive écart', () => {
    const { container } = card({ value: 80, threshold: 60, mode: 'floor' });
    expect(ecart(container).textContent).toBe('+20');
    expect(ecart(container).className).toContain(styles.ecartGood);
  });

  it('ceiling above threshold → red positive écart', () => {
    const { container } = card({ value: 250, threshold: 200, mode: 'ceiling' });
    expect(ecart(container).textContent).toBe('+50');
    expect(ecart(container).className).toContain(styles.ecartBad);
  });

  it('ceiling below threshold → green negative écart', () => {
    const { container } = card({ value: 150, threshold: 200, mode: 'ceiling' });
    expect(ecart(container).textContent).toBe('−50');
    expect(ecart(container).className).toContain(styles.ecartGood);
  });

  it('no écart when there is no threshold or the card is muted', () => {
    expect(ecart(card({ value: 40, threshold: null }).container)).toBeNull();
    expect(ecart(card({ value: 40, threshold: 60, muted: true }).container)).toBeNull();
  });
});

// B-174: the macro card label is colour-coded by macro (the value/bar/status are unchanged).
describe('MacroCard label accent (B-174)', () => {
  it('tints the label with the per-macro class when an accent is given', () => {
    const { container } = render(
      <MacroCard
        label="Lipides"
        value={10}
        threshold={50}
        mode="floor"
        thresholdText="min. 50 g"
        status={{ ok: 'OK', bad: 'NOK' }}
        unit="g"
        accent="fat"
      />,
    );
    const label = container.querySelector(`.${styles.label}`) as HTMLElement;
    expect(label.className).toContain(styles.fat);
  });

  it('leaves the label neutral when no accent is given (e.g. the Calories card)', () => {
    const { container } = render(
      <MacroCard
        label="Protéines"
        value={10}
        threshold={50}
        mode="floor"
        thresholdText="min. 50 g"
        status={{ ok: 'OK', bad: 'NOK' }}
        unit="g"
      />,
    );
    const label = container.querySelector(`.${styles.label}`) as HTMLElement;
    expect(label.className).not.toContain(styles.fat);
    expect(label.className).not.toContain(styles.prot);
  });
});
