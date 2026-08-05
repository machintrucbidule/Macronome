// Transient-confirmation store (B-261, design/components/toasts-warnings.md §E).
//
// Deliberately NEUTRAL: it knows nothing about meals, days or the undo mechanism — the caller
// supplies the `undo` callback. That is what lets the provider be mounted at the app root even
// though the Repas history lives inside MealsProvider (MealsPage.tsx), which the root is outside
// of. Anything that can call a function can raise a confirmation.
//
// A plain external store rather than context state so the timer logic stays out of React's
// render path and `showToast` can be called from an event handler anywhere in the tree.

export interface ToastRequest {
  message: string;
  /** When provided, the toast shows an "Annuler" action that calls this. Optional by design:
   *  only reversible actions get one, and the toast is the ONLY affordance (owner decision). */
  undo?: () => void | Promise<void>;
}

export interface ToastState extends ToastRequest {
  /** Monotonic id — the React key, so a replacing toast restarts its animation and timer. */
  id: number;
}

/** Visible duration. Longer with an action: the user must have time to read AND reach it. */
export const TOAST_MS = 4000;
export const TOAST_UNDO_MS = 8000;

let current: ToastState | null = null;
let nextId = 1;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** Raise a confirmation. One at a time — a new one replaces the current (§E). */
export function showToast(request: ToastRequest): void {
  current = { ...request, id: nextId++ };
  emit();
}

/** Dismiss the toast, whether by timeout, by the close affordance, or after Annuler ran. */
export function dismissToast(id?: number): void {
  if (current === null) return;
  if (id !== undefined && current.id !== id) return; // a stale timer, already replaced
  current = null;
  emit();
}

export function subscribeToast(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getToast(): ToastState | null {
  return current;
}

// Some confirmations belong to an action that reloads the page — the data import replaces every
// cached query, the theme and the locale, so it reloads on success (IMP-1). A toast raised just
// before that would be wiped with the document, so it is handed across the reload instead.
const FLASH_KEY = 'macronome.toast.flash';

/** Show this message once the page has reloaded. No-op where sessionStorage is unavailable. */
export function toastAfterReload(message: string): void {
  try {
    sessionStorage.setItem(FLASH_KEY, message);
  } catch {
    // A private-mode / disabled-storage browser simply loses the confirmation; never throw here.
  }
}

/** Take the pending post-reload message, if any. Consumed once — a second reload shows nothing. */
export function consumePendingToast(): string | null {
  try {
    const message = sessionStorage.getItem(FLASH_KEY);
    if (message !== null) sessionStorage.removeItem(FLASH_KEY);
    return message;
  } catch {
    return null;
  }
}

/** Test seam: clear the store between cases. */
export function resetToasts(): void {
  current = null;
  nextId = 1;
  listeners.clear();
}
