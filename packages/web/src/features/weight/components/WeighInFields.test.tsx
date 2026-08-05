import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import '../../../i18n/config';
import { WeighInFields, type WeighInDraft } from './WeighInFields';

// B-270 (design/components/mobile.md §Cross-cutting rules): a decimal call site of the shared
// NumberInput. The weight steps by 0.1 kg and the waist declares no step at all — both must open
// the phone keypad *with* its decimal separator, or 84.5 kg becomes untypable.
afterEach(cleanup);

const draft: WeighInDraft = {
  date: '2026-01-05',
  weight: '82.4',
  waist: '88',
  flag: 'in_diet',
  note: '',
};

describe('WeighInFields — phone keyboard (B-270)', () => {
  it('gives the weight and waist fields a decimal keypad', () => {
    const { container } = render(<WeighInFields draft={draft} set={vi.fn()} error={null} />);
    // The two numeric fields in source order: weight (step 0.1) then waist (no step).
    const [weight, waist] = [...container.querySelectorAll<HTMLInputElement>('input[type=number]')];
    expect(weight?.step).toBe('0.1');
    expect(weight?.getAttribute('inputmode')).toBe('decimal');
    expect(waist?.step).toBe('');
    expect(waist?.getAttribute('inputmode')).toBe('decimal');
  });
});
