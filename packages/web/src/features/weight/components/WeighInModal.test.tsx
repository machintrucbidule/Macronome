import { createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, type RenderResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { WeighIn } from '@macronome/shared';
import i18n from '../../../i18n/config';
import { WeighInModal } from './WeighInModal';

// B-179: the add modal pre-fills weight/waist from the most recent weigh-in; without one
// the fields stay empty; edit mode keeps the edited weigh-in's own values.
function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client }, children);
}

function weighIn(overrides: Partial<WeighIn>): WeighIn {
  return {
    id: 'w1',
    date: '2026-06-30',
    weight_kg: 82.4,
    waist_cm: 88.5,
    diet_flag: 'in_diet',
    note: null,
    ...overrides,
  };
}

function renderModal(target: Parameters<typeof WeighInModal>[0]['target'], last: WeighIn | null) {
  return render(
    <WeighInModal target={target} defaultFlag="in_diet" lastWeighIn={last} onClose={vi.fn()} />,
    { wrapper },
  );
}

// NumberInput's label also wraps the unit suffix + stepper, so match the accessible
// name by prefix instead of the exact label text.
const field = (r: RenderResult, label: string): HTMLInputElement =>
  r.getByRole('spinbutton', { name: new RegExp(`^${label}`) }) as HTMLInputElement;
const inputValue = (r: RenderResult, label: string): string => field(r, label).value;
const weight = (r: RenderResult): string => inputValue(r, i18n.t('weight.field.weight'));
const waist = (r: RenderResult): string => inputValue(r, i18n.t('weight.field.waist'));

/** The ▲▼ stepper buttons of a field (aria-hidden, so reached through its wrapper). */
function arrows(r: RenderResult, label: string): { up: HTMLElement; down: HTMLElement } {
  const btns = (field(r, label).parentElement as HTMLElement).querySelectorAll('button');
  return { up: btns[0] as HTMLElement, down: btns[1] as HTMLElement };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('WeighInModal — add-mode pre-fill (B-179)', () => {
  it('pre-fills weight and waist from the last weigh-in in add mode', () => {
    const r = renderModal({ kind: 'add' }, weighIn({}));
    expect(weight(r)).toBe('82.4');
    expect(waist(r)).toBe('88.5');
  });

  it('leaves waist empty when the last weigh-in has none', () => {
    const r = renderModal({ kind: 'add' }, weighIn({ waist_cm: null }));
    expect(weight(r)).toBe('82.4');
    expect(waist(r)).toBe('');
  });

  it('starts empty in add mode without any weigh-in', () => {
    const r = renderModal({ kind: 'add' }, null);
    expect(weight(r)).toBe('');
    expect(waist(r)).toBe('');
  });

  it('keeps the edited weigh-in values in edit mode (lastWeighIn ignored)', () => {
    const edited = weighIn({ id: 'w0', date: '2026-06-01', weight_kg: 84.1, waist_cm: 90 });
    const r = renderModal({ kind: 'edit', weighIn: edited }, weighIn({}));
    expect(weight(r)).toBe('84.1');
    expect(waist(r)).toBe('90');
  });
});

describe('WeighInModal — weight stepper (B-251)', () => {
  const seeded = () => renderModal({ kind: 'add' }, weighIn({ weight_kg: 75, waist_cm: 88 }));

  it('steps the weight up by 0.1 kg', () => {
    const r = seeded();
    fireEvent.click(arrows(r, i18n.t('weight.field.weight')).up);
    expect(weight(r)).toBe('75.1');
  });

  it('steps the weight down by 0.1 kg', () => {
    const r = seeded();
    fireEvent.click(arrows(r, i18n.t('weight.field.weight')).down);
    expect(weight(r)).toBe('74.9');
  });

  it('keeps the waist stepper at 1 cm', () => {
    const r = seeded();
    fireEvent.click(arrows(r, i18n.t('weight.field.waist')).up);
    expect(waist(r)).toBe('89');
  });
});
