import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { useRef } from 'react';
import { resetOverlayStack } from '../../../components/Modal/useOverlayDismiss';
import { useMealPhotoDrop } from './useMealPhotoDrop';
import type { MealPhotoEntry } from './useMealPhotoEntry';

// B-271: a meal column takes a dropped image, and a pasted screenshot ONLY when that column is
// focused, nothing is being typed and no overlay is open. The app never picks a meal on the
// user's behalf — the guards are the feature.

afterEach(() => {
  cleanup();
  resetOverlayStack();
  vi.restoreAllMocks();
});

const png = (name = 'shot.png'): File =>
  new File([new Uint8Array([1])], name, { type: 'image/png' });
const pdf = (): File => new File([new Uint8Array([1])], 'doc.pdf', { type: 'application/pdf' });

function photoStub(analyseFile: (f: File) => void): MealPhotoEntry {
  return {
    ready: false,
    configured: true,
    analyseFile,
    busy: false,
    message: null,
    trigger: () => undefined,
    dismiss: () => undefined,
    inputRef: { current: null },
    inputProps: {
      type: 'file',
      accept: '',
      capture: 'environment',
      hidden: true,
      onChange: () => undefined,
    },
  };
}

function Column({
  analyseFile,
  enabled = true,
}: {
  analyseFile: (f: File) => void;
  enabled?: boolean;
}) {
  const drop = useMealPhotoDrop(photoStub(analyseFile), enabled);
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div ref={drop.ref} data-testid="col" tabIndex={-1} {...drop.dropProps}>
      <input ref={inputRef} data-testid="field" />
    </div>
  );
}

/** A DataTransfer-ish payload: jsdom has no real one. */
const transfer = (files: File[]) =>
  ({ types: ['Files'], files, items: [] }) as unknown as DataTransfer;

function paste(files: File[]): void {
  const e = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent;
  Object.defineProperty(e, 'clipboardData', { value: transfer(files) });
  act(() => {
    document.dispatchEvent(e);
  });
}

describe('drop an image on a meal column (B-271)', () => {
  it('analyses a dropped image', () => {
    const analyse = vi.fn();
    const { getByTestId } = render(<Column analyseFile={analyse} />);
    const col = getByTestId('col');
    act(() => {
      const e = new Event('drop', { bubbles: true, cancelable: true });
      Object.defineProperty(e, 'dataTransfer', { value: transfer([png()]) });
      col.dispatchEvent(e);
    });
    expect(analyse).toHaveBeenCalledTimes(1);
    expect((analyse.mock.calls[0] as [File])[0].type).toBe('image/png');
  });

  it('still hands a wrong-type file over, so it can be refused VISIBLY rather than ignored', () => {
    const analyse = vi.fn();
    const { getByTestId } = render(<Column analyseFile={analyse} />);
    act(() => {
      const e = new Event('drop', { bubbles: true, cancelable: true });
      Object.defineProperty(e, 'dataTransfer', { value: transfer([pdf()]) });
      getByTestId('col').dispatchEvent(e);
    });
    expect(analyse).toHaveBeenCalledTimes(1);
    expect((analyse.mock.calls[0] as [File])[0].type).toBe('application/pdf');
  });
});

describe('paste an image on a meal column (B-271)', () => {
  it('analyses it when the column has focus', () => {
    const analyse = vi.fn();
    const { getByTestId } = render(<Column analyseFile={analyse} />);
    getByTestId('col').focus();
    paste([png()]);
    expect(analyse).toHaveBeenCalledTimes(1);
  });

  it('does nothing when no meal column has focus — never a silent guess', () => {
    const analyse = vi.fn();
    render(<Column analyseFile={analyse} />);
    (document.activeElement as HTMLElement | null)?.blur();
    paste([png()]);
    expect(analyse).not.toHaveBeenCalled();
  });

  it('leaves a paste into a text field alone', () => {
    const analyse = vi.fn();
    const { getByTestId } = render(<Column analyseFile={analyse} />);
    (getByTestId('field') as HTMLInputElement).focus();
    paste([png()]);
    expect(analyse).not.toHaveBeenCalled();
  });

  it('is inert on mobile (the phone has its own 📷 button)', () => {
    const analyse = vi.fn();
    const { getByTestId } = render(<Column analyseFile={analyse} enabled={false} />);
    getByTestId('col').focus();
    paste([png()]);
    expect(analyse).not.toHaveBeenCalled();
  });
});
