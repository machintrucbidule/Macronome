import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '../../../i18n/config';

// PWA-1/B-143: a "Prendre une photo" camera button appears only on the phone layout, beside the
// gallery button; desktop is unchanged (no camera button, no capture input). useIsMobile and the
// AI mutation are mocked so the test only exercises the picker's affordances.
const mocks = vi.hoisted(() => ({ isMobile: false }));
vi.mock('../../../lib/useIsMobile', () => ({ useIsMobile: () => mocks.isMobile }));
vi.mock('../hooks/useAi', () => ({
  useDishPhotoMacros: () => ({ isPending: false, mutate: vi.fn() }),
}));
import { AiDishAnalysisDialog } from './AiDishAnalysisDialog';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.isMobile = false;
});

function renderDialog() {
  return render(<AiDishAnalysisDialog onClose={vi.fn()} onApplied={vi.fn()} />);
}

describe('AiDishAnalysisDialog — camera capture (B-143)', () => {
  it('offers a camera button with a capture input on the phone layout', () => {
    mocks.isMobile = true;
    renderDialog();
    expect(screen.getByText('Prendre une photo')).toBeTruthy();
    expect(document.querySelector('input[capture="environment"]')).not.toBeNull();
  });

  it('shows only the gallery button on desktop (no camera affordance)', () => {
    mocks.isMobile = false;
    renderDialog();
    expect(screen.getByText('Ajouter des photos')).toBeTruthy();
    expect(screen.queryByText('Prendre une photo')).toBeNull();
    expect(document.querySelector('input[capture="environment"]')).toBeNull();
  });
});
