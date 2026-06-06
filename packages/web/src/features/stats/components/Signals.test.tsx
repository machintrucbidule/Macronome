import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { Signal } from '@macronome/shared';
import i18n from '../../../i18n/config';
import { Signals } from './Signals';

// The signals block renders factual, server-computed signals. It derives nothing: the dot
// colour follows the server `status` (rule 2), the text is localized via stats.signal.<code>.
afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('fr');
});

const sig = (over: Partial<Signal>): Signal => ({
  code: 'ok_rate_14',
  value: 0,
  status: 'warn',
  text: '14-day OK rate 0%',
  ...over,
});

describe('Signals', () => {
  it('shows the empty state when there are no signals', () => {
    const { container } = render(<Signals signals={[]} />);
    expect(container.textContent ?? '').toContain('Aucun signal');
  });

  it('localizes the no-NOK-run signal and the 14-day OK rate', () => {
    const { container } = render(
      <Signals
        signals={[
          sig({ code: 'nok_run_clear', value: 0, status: 'ok' }),
          sig({ code: 'ok_rate_14', value: 0, status: 'warn' }),
        ]}
      />,
    );
    const text = container.textContent ?? '';
    expect(text).toContain('Pas de série NOK en cours.');
    expect(text).toContain('Taux OK sur 14 j : 0 %');
  });

  it('drives the dot colour from the server status (ok vs warn differ)', () => {
    const { container } = render(
      <Signals
        signals={[
          sig({ code: 'nok_run_clear', status: 'ok' }),
          sig({ code: 'ok_rate_14', status: 'warn' }),
        ]}
      />,
    );
    const dots = Array.from(container.querySelectorAll('li > span:first-child'));
    expect(dots).toHaveLength(2);
    expect(dots[0]!.className).not.toBe(dots[1]!.className); // ok ≠ warn
  });
});
