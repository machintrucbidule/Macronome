import { useEffect, useRef, useState, type RefObject } from 'react';

// Open-state of the day calendar popover (B-297). It used to be private to `DateNavigator`, which
// made the ▦ button its only trigger; the date label next to it must open the same popover, so the
// state moved one level up. Both triggers count as "inside" for the outside-click dismissal —
// otherwise the label's own mousedown would close the popover a beat before its click re-opened it.
export interface CalendarPopoverState {
  open: boolean;
  toggle: () => void;
  close: () => void;
  /** Goes on the navigator (the popover's positioning context, `.dateNav`). */
  navRef: RefObject<HTMLDivElement>;
  /** Goes on the date label, the second trigger. */
  labelRef: RefObject<HTMLDivElement>;
}

export function useCalendarPopover(): CalendarPopoverState {
  const [open, setOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent): void => {
      const target = e.target as Node;
      if (navRef.current?.contains(target) === true) return;
      if (labelRef.current?.contains(target) === true) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return {
    open,
    toggle: () => setOpen((o) => !o),
    close: () => setOpen(false),
    navRef,
    labelRef,
  };
}
