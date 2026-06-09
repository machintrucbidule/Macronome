import { useEffect } from 'react';

// Ctrl/Cmd+Z (undo) and Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z (redo) for the Repas screen (UR-1 / B-133).
// Bails while a text field, contenteditable or a modal dialog is focused so it never fights
// QtyCell's own key handling or the browser's native field undo.
interface UndoRedo {
  undo: () => void;
  redo: () => void;
}

function isTextTarget(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    (el as HTMLElement).isContentEditable ||
    el.closest('[role="dialog"]') !== null
  );
}

export function useUndoRedoKeys({ undo, redo }: UndoRedo): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!(e.ctrlKey || e.metaKey) || isTextTarget(document.activeElement)) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [undo, redo]);
}
