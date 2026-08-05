import type { KeyboardEvent } from 'react';

// Keyboard model for SelectMenu (design/components/forms-inputs.md §Select). Focus stays on the
// trigger and the highlighted option is announced through aria-activedescendant — the pattern a
// native <select> gives for free, and which had to be rebuilt when the form selects moved off it.
interface MenuKeysArgs {
  open: boolean;
  count: number;
  active: number;
  selectedIndex: number;
  openAt: (index: number) => void;
  setActive: (index: number) => void;
  commit: (index: number) => void;
  close: () => void;
}

const OPEN_KEYS = ['ArrowDown', 'ArrowUp', 'Enter', ' '];
const COMMIT_KEYS = ['Enter', ' '];

const clamp = (i: number, count: number): number => Math.max(0, Math.min(i, count - 1));

/** Where the highlight lands when the list opens: on the current value, else top (or bottom on ↑). */
const entryIndex = (key: string, selectedIndex: number, count: number): number => {
  if (selectedIndex >= 0) return selectedIndex;
  return key === 'ArrowUp' ? count - 1 : 0;
};

export function menuKeyHandler(a: MenuKeysArgs) {
  return (e: KeyboardEvent<HTMLDivElement>): void => {
    if (a.count === 0) return;
    if (!a.open) {
      if (!OPEN_KEYS.includes(e.key)) return;
      e.preventDefault();
      a.openAt(entryIndex(e.key, a.selectedIndex, a.count));
      return;
    }
    const moves: Record<string, number | undefined> = {
      ArrowDown: a.active + 1,
      ArrowUp: a.active - 1,
      Home: 0,
      End: a.count - 1,
    };
    const next = moves[e.key];
    if (next !== undefined) {
      e.preventDefault();
      a.setActive(clamp(next, a.count));
      return;
    }
    if (COMMIT_KEYS.includes(e.key)) {
      e.preventDefault();
      a.commit(a.active);
      return;
    }
    // Let focus leave naturally on Tab, but do not leave an orphan panel behind.
    if (e.key === 'Tab') a.close();
  };
}
