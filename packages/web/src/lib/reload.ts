/**
 * Full page reload. Its own module because `window.location` is unforgeable in jsdom — a caller
 * that reloads can only be tested if the reload itself can be mocked (B-285).
 */
export function reloadPage(): void {
  window.location.reload();
}
