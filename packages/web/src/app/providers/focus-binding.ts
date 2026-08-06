import { focusManager } from '@tanstack/react-query';

// Make `refetchOnWindowFocus` mean what it says in the INSTALLED window (B-294 / D17).
//
// query-core's default focus listener binds `visibilitychange` only. A browser tab fires that on
// every tab switch, so the default works there — but a non-minimised, non-occluded Windows PWA
// window does not emit it on alt-tab, so in the installed app NO query ever refetched on return
// to focus. The only refresh trigger left was a fresh mount, i.e. restarting the app.
//
// Binding `focus` alongside it is TanStack's documented escape hatch. App-wide on purpose: this is
// not a day-tone quirk, every screen was equally stale.

/** Bind window `focus` in addition to `visibilitychange`. Returns the unbind function. */
export function bindWindowFocus(): () => void {
  focusManager.setEventListener((handleFocus) => {
    const onFocus = (): void => handleFocus();
    window.addEventListener('visibilitychange', onFocus, false);
    window.addEventListener('focus', onFocus, false);
    return () => {
      window.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('focus', onFocus);
    };
  });
  return () => focusManager.setEventListener(() => () => undefined);
}
