// Text-field exception for the installed-window context menu (B-195): inside editable
// fields the NATIVE browser menu is preserved (paste / spellcheck / text services).

const EDITABLE = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';

export function isNativeMenuTarget(el: Element | null): boolean {
  return el !== null && el.closest(EDITABLE) !== null;
}
