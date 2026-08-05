import { useEffect, useId, useRef, useState } from 'react';
import { useMenuPlacement } from '../../lib/useMenuPlacement';
import { menuKeyHandler } from './useMenuKeys';
import type { SelectMenuOption } from './SelectMenu';

// Open/close + highlight state for SelectMenu, split out so the component stays presentational.
// Closing always returns focus to the trigger (forms-inputs.md §Select) — an outside click is the
// one exception, since focus has already moved wherever the user clicked.
export function useSelectMenu<T extends string>(
  options: SelectMenuOption<T>[],
  value: T,
  onChange: (value: T) => void,
) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const placement = useMenuPlacement(open, wrapRef, menuRef, options.length);
  const listId = useId();

  const close = (): void => {
    setOpen(false);
    setActive(-1);
    triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent): void => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setActive(-1);
      }
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const selectedIndex = options.findIndex((o) => o.value === value);
  const choose = (v: T): void => {
    onChange(v);
    close();
  };

  return {
    open,
    active,
    listId,
    // Wired onto the trigger: the panel it owns, and the option the keyboard is currently on.
    controlsId: open ? listId : undefined,
    activeDescendantId: open && active >= 0 ? `${listId}-${active}` : undefined,
    placement,
    wrapRef,
    menuRef,
    triggerRef,
    selectedIndex,
    current: selectedIndex < 0 ? undefined : options[selectedIndex],
    choose,
    toggle: (): void => (open ? close() : setOpen(true)),
    onKeyDown: menuKeyHandler({
      open,
      count: options.length,
      active,
      selectedIndex,
      openAt: (i) => {
        setOpen(true);
        setActive(i);
      },
      setActive,
      commit: (i) => {
        const o = options[i];
        if (o) choose(o.value);
      },
      close,
    }),
  };
}
