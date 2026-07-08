// App-shortcut / deep-link launch handling (B-183 follow-up). The manifest declares
// `launch_handler: { client_mode: 'focus-existing' }`, so when the installed app is already
// open the browser only FOCUSES the window and enqueues the target URL into
// window.launchQueue — the app must consume it to navigate (otherwise the URL is dropped and
// clicking a shortcut appears to do nothing). LaunchQueue is a Chromium/Edge-only API and not
// in the DOM lib, hence the minimal ambient types below.

export interface LaunchParams {
  readonly targetURL?: string;
}
export interface LaunchQueue {
  setConsumer(consumer: (params: LaunchParams) => void): void;
}
declare global {
  interface Window {
    launchQueue?: LaunchQueue;
  }
}

/** The in-app path (pathname + search) a launch should navigate to, or null when there is
 *  nothing to do — a plain focus / clicking the screen already shown (same URL), or a
 *  missing/unparseable target. Only the path+search is used (same-origin SPA route). */
export function launchTargetPath(targetURL: string | undefined, current: string): string | null {
  if (!targetURL) return null;
  let path: string;
  try {
    const url = new URL(targetURL, window.location.origin);
    path = url.pathname + url.search;
  } catch {
    return null;
  }
  return path === current ? null : path;
}
