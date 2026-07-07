import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { DishPhotoMacros } from '@macronome/shared';
import '../../../i18n/config';

// PWA-1/B-143: a "Prendre une photo" camera button appears only on the phone layout, beside the
// gallery button; desktop is unchanged (no camera button, no capture input). DS-1/B-160: a
// "no food detected" success keeps the dialog open with an info message and does not pre-fill.
// useIsMobile and the AI mutation are mocked so the test only exercises the dialog's behaviour;
// when `response` is set, the mocked mutate invokes onSuccess with it synchronously.
const mocks = vi.hoisted(() => ({
  isMobile: false,
  response: null as { data: DishPhotoMacros } | null,
}));
vi.mock('../../../lib/useIsMobile', () => ({ useIsMobile: () => mocks.isMobile }));
vi.mock('../hooks/useAi', () => ({
  useDishPhotoMacros: () => ({
    isPending: false,
    mutate: (_vars: unknown, opts?: { onSuccess?: (res: { data: DishPhotoMacros }) => void }) => {
      if (mocks.response) opts?.onSuccess?.(mocks.response);
    },
  }),
}));
import { AiDishAnalysisDialog } from './AiDishAnalysisDialog';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.isMobile = false;
  mocks.response = null;
});

function renderDialog(onApplied = vi.fn()) {
  return { onApplied, ...render(<AiDishAnalysisDialog onClose={vi.fn()} onApplied={onApplied} />) };
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

// B-184: the gallery button is a live drop zone and Ctrl+V pastes clipboard images (named
// capture-N); paste is intercepted only when image files are present. Ignored files (cap /
// unsupported type) show a faint transient hint. FileReader is async → await find* queries.
describe('AiDishAnalysisDialog — paste & drop (B-184)', () => {
  const png = (name: string) => new File(['x'], name, { type: 'image/png' });

  it('drop on the gallery button adds a thumbnail', async () => {
    renderDialog();
    fireEvent.drop(screen.getByText('Ajouter des photos'), {
      dataTransfer: { files: [png('dish.png')] },
    });
    expect(await screen.findByAltText('dish.png')).toBeTruthy();
  });

  it('non-image drop is ignored and shows the type hint', () => {
    renderDialog();
    fireEvent.drop(screen.getByText('Ajouter des photos'), {
      dataTransfer: { files: [new File(['x'], 'notes.txt', { type: 'text/plain' })] },
    });
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText(/Format non supporté/i)).toBeTruthy();
  });

  it('image paste is intercepted and adds a capture-N thumbnail', async () => {
    renderDialog();
    const notPrevented = fireEvent.paste(document, {
      clipboardData: { files: [png('image.png')] },
    });
    expect(notPrevented).toBe(false); // preventDefault was called (image files present)
    expect(await screen.findByAltText('capture-1')).toBeTruthy();
  });

  it('text-only paste stays native (no interception, no thumbnail)', () => {
    renderDialog();
    const notPrevented = fireEvent.paste(document, { clipboardData: { files: [] } });
    expect(notPrevented).toBe(true);
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('files beyond the 4-image cap are ignored with the cap hint', async () => {
    renderDialog();
    fireEvent.drop(screen.getByText('Ajouter des photos'), {
      dataTransfer: { files: [1, 2, 3, 4, 5].map((n) => png(`d${n}.png`)) },
    });
    expect(await screen.findByAltText('d4.png')).toBeTruthy();
    expect(screen.queryByAltText('d5.png')).toBeNull();
    expect(screen.getByText(/Maximum 4 photos/i)).toBeTruthy();
  });
});

describe('AiDishAnalysisDialog — no food detected (DS-1/B-160)', () => {
  const NO_FOOD = {
    data: {
      detected: false,
      dish_name: '',
      kcal: 0,
      weight_g: 0,
      fat_g: 0,
      carb_g: 0,
      protein_g: 0,
    },
  };
  const FOUND = {
    data: {
      detected: true,
      dish_name: 'Pasta',
      kcal: 620,
      weight_g: 350,
      fat_g: 18,
      carb_g: 80,
      protein_g: 24,
    },
  };

  function analyseWith(response: { data: DishPhotoMacros }) {
    mocks.response = response;
    const { onApplied } = renderDialog();
    fireEvent.change(screen.getByPlaceholderText(/saucisson/i), {
      target: { value: 'un repas' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Analyser' }));
    return onApplied;
  }

  it('on detected:false shows the no-food message and does not pre-fill', () => {
    const onApplied = analyseWith(NO_FOOD);
    expect(screen.getByText(/Aucun aliment détecté/i)).toBeTruthy();
    expect(onApplied).not.toHaveBeenCalled();
  });

  it('on detected:true applies the result (no no-food message)', () => {
    const onApplied = analyseWith(FOUND);
    expect(onApplied).toHaveBeenCalledWith(FOUND.data);
    expect(screen.queryByText(/Aucun aliment détecté/i)).toBeNull();
  });
});
