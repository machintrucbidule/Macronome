import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18n from '../../../i18n/config';
import { RatioPresets, PROTEIN_PRESETS, FAT_PRESETS } from './RatioPresets';

// B-007: clickable g/kg guidance presets. Each renders a value chip + a guiding caption, and
// picking one fills the bound field with the exact value string (canonical dot-decimal).
afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('fr');
});

describe('RatioPresets', () => {
  it('renders one button per preset with its guiding caption', () => {
    render(<RatioPresets presets={PROTEIN_PRESETS} onPick={() => {}} />);
    expect(screen.getAllByRole('button')).toHaveLength(3);
    // getByText throws if absent — its return is the presence assertion.
    expect(screen.getByText(/Sédentaire/)).toBeTruthy();
    expect(screen.getByText(/Actif/)).toBeTruthy();
    expect(screen.getByText(/Sportif intensif/)).toBeTruthy();
  });

  it('fills the field with the exact protein value string on click', () => {
    const onPick = vi.fn<(value: string) => void>();
    render(<RatioPresets presets={PROTEIN_PRESETS} onPick={onPick} />);
    screen.getAllByRole('button').forEach((btn) => fireEvent.click(btn));
    expect(onPick.mock.calls.map((c) => c[0])).toEqual(['0.8', '1.8', '2.2']);
  });

  it('fills the field with the exact fat value string on click', () => {
    const onPick = vi.fn<(value: string) => void>();
    render(<RatioPresets presets={FAT_PRESETS} onPick={onPick} />);
    const [min, , high] = screen.getAllByRole('button');
    fireEvent.click(min!);
    fireEvent.click(high!);
    expect(onPick.mock.calls.map((c) => c[0])).toEqual(['0.6', '1.2']);
  });
});
