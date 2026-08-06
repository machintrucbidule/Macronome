import { useEffect, useRef, useState, type DragEvent, type MutableRefObject } from 'react';
import { overlayDepth } from '../../../components/Modal/useOverlayDismiss';
import { firstAcceptedImage, imageFilesOf } from '../lib/imagePick';
import type { MealPhotoEntry } from './useMealPhotoEntry';

// Desktop photo intake for a meal column (B-271): drop an image from the file explorer onto the
// column, or paste a screenshot with that column focused. Both feed the SAME flow as the phone's
// 📷 button — `photo.analyseFile` — so there is one analysis path with two file sources.
//
// Mobile is excluded by the caller (`enabled`): the phone has its button, and a document-level
// paste listener there would be pointless.

/** A control the user is typing into — a paste there belongs to the field, not to us. */
function isTextEntry(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

interface DropProps {
  onDragOver: (e: DragEvent<HTMLElement>) => void;
  onDragEnter: (e: DragEvent<HTMLElement>) => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent<HTMLElement>) => void;
}

export interface MealPhotoDrop {
  /** Attach to the column element: it is both the drop surface and the paste-focus scope. */
  ref: MutableRefObject<HTMLDivElement | null>;
  /** True while a drag hovers the column — the caller paints the highlight. */
  dragOver: boolean;
  /** Spread onto the column; bundled so the call site stays one line. */
  dropProps: DropProps;
}

export function useMealPhotoDrop(photo: MealPhotoEntry, enabled: boolean): MealPhotoDrop {
  const [dragOver, setDragOver] = useState(false);
  const columnRef = useRef<HTMLDivElement | null>(null);
  const analyseFile = photo.analyseFile;

  useEffect(() => {
    if (!enabled) return;
    const onPaste = (e: ClipboardEvent): void => {
      // Three guards, and the app never guesses past them (owner decision):
      //  · no overlay open — a dialog's own paste handling wins (the AI picker has one);
      //  · not typing — text paste stays native everywhere;
      //  · the focus is inside THIS column — otherwise we would be picking a meal for the user.
      // Each column runs its own listener, so the third guard is what makes exactly one act.
      if (overlayDepth() > 0) return;
      const active = document.activeElement;
      if (isTextEntry(active)) return;
      if (!columnRef.current?.contains(active)) return;
      const files = imageFilesOf(e.clipboardData);
      if (files.length === 0) return; // a text paste with nothing focused: leave it alone
      e.preventDefault();
      analyseFile(firstAcceptedImage(files) ?? (files[0] as File));
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [enabled, columnRef, analyseFile]);

  if (!enabled) {
    const noop = (): void => undefined;
    const inert = { onDragOver: noop, onDragEnter: noop, onDragLeave: noop, onDrop: noop };
    return { ref: columnRef, dragOver: false, dropProps: inert };
  }

  const dropProps: DropProps = {
    // preventDefault on dragover is what makes the element a drop target at all.
    onDragOver: (e) => e.preventDefault(),
    onDragEnter: (e) => {
      // Ignore the internal line drag (B-029/B-187): it carries no files, and highlighting the
      // column for it would read as "drop a photo here".
      if (e.dataTransfer.types.includes('Files')) setDragOver(true);
    },
    onDragLeave: () => setDragOver(false),
    onDrop: (e) => {
      if (!e.dataTransfer.types.includes('Files')) return; // let the line-reorder drop through
      e.preventDefault();
      setDragOver(false);
      const files = imageFilesOf(e.dataTransfer);
      // Pass the first file even when it is the wrong type: `analyseFile` refuses it visibly,
      // which is the contract — never a silent nothing-happened.
      const file = firstAcceptedImage(files) ?? files[0];
      if (file) analyseFile(file);
    },
  };
  return { ref: columnRef, dragOver, dropProps };
}
