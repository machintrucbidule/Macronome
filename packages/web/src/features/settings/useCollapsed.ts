import { useState } from 'react';

// Per-card collapsed/expanded state for the Settings page (B-209), persisted client-side in
// localStorage under a single JSON map keyed by a stable card id. Pure UI preference — not
// server-backed, so it does not sync across devices (mirrors the macronome.theme fast-path
// idiom). Reads/writes are guarded (private mode / quota / bad JSON never throw).
const STORAGE_KEY = 'macronome.settings.collapsed';

type CollapsedMap = Record<string, boolean>;

function readMap(): CollapsedMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as CollapsedMap) : {};
  } catch {
    return {};
  }
}

/** Persist one card's open state, merging onto the live map so sibling cards are preserved. */
function writeOpen(id: string, open: boolean): void {
  try {
    const map = readMap();
    map[id] = open;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore — persistence is best-effort
  }
}

/** `[open, setOpen]` for the card `id`; initial value is the stored one, else `defaultOpen`. */
export function useCollapsed(id: string, defaultOpen: boolean): [boolean, (open: boolean) => void] {
  const [open, setOpenState] = useState<boolean>(() => readMap()[id] ?? defaultOpen);
  const setOpen = (next: boolean): void => {
    setOpenState(next);
    writeOpen(id, next);
  };
  return [open, setOpen];
}
