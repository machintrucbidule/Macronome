// The navigation glyph set (B-312), extracted from `BottomNav.tsx` so the bar, and the guard test
// that keeps the taskbar shortcuts in step with it, read one file.
//
// ONE CONTRACT FOR ALL SEVEN (design/components/bottom-nav.md §Icon contract):
//   - 24×24 viewBox, `fill:none; stroke:currentColor; stroke-width:1.7`
//   - `stroke-linecap:round; stroke-linejoin:round` — declared by the wrapper in `BottomNav.tsx`.
//     Before B-312 the wrapper declared neither, so the bar rendered butt caps and miter joins
//     while `icons/shortcut-*.svg` — supposed to be the same marks — declared round on both.
//   - every glyph fills the same optical square and shares one vertical extent (y ≈ 3 → 21);
//     a mark that could not fill it was redrawn rather than left short.
//
// The set was reviewed and approved by the owner before implementation. Repas keeps its fork and
// knife (the fork gained the handle it never had — its stem used to stop at y=11 while the knife
// ran to y=21, which is why it read as a floating head), Journal its calendar, Stats its bars.
// Poids' low dome became a square bathroom scale, Recettes' angled closed book became an open
// book (its two inner text lines blurred at 24px), Aliments' three-arc leaf became an apple, and
// Conseils is new — a stroke lightbulb, not the filled glyph the removed appbar button used.
//
// `meals` / `weight` / `journal` / `stats` are ALSO the taskbar shortcut icons (B-259): redrawing
// one side without the other fails `shortcut-icons.test.ts`.

export const ICON = {
  meals: (
    <>
      <path d="M7 3v4a2.5 2.5 0 0 0 5 0V3M9.5 3v4M9.5 9.5V21" />
      <path d="M17 21V3c-1.9 1.2-3 4-3 6.6 0 1.1.6 1.6 3 1.6" />
    </>
  ),
  journal: (
    <>
      <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  weight: (
    <>
      <rect x="3.5" y="4" width="17" height="17" rx="3" />
      <path d="M8 15.5a4 4 0 0 1 8 0" />
      <path d="M12 15.5 14.6 12.8" />
    </>
  ),
  foods: (
    <>
      <path d="M12 8.4C10.8 7.2 9.3 6.5 7.7 6.5 4.6 6.5 2.5 9.2 2.5 12.7c0 4.3 3.2 8.3 5.8 8.3 1.2 0 2.4-.6 3.7-.6s2.5.6 3.7.6c2.6 0 5.8-4 5.8-8.3 0-3.5-2.1-6.2-5.2-6.2-1.6 0-3.1.7-4.3 1.9Z" />
      <path d="M12 8.2V4.4" />
      <path d="M12.2 5.9c.5-1.7 2.1-2.8 3.9-2.7.3 1.9-1.1 3.5-3 3.5h-.9" />
    </>
  ),
  recipes: (
    <>
      <path d="M12 6.6C10.4 5 7.8 4.2 3.5 4.2V18c4.3 0 6.9.8 8.5 2.4 1.6-1.6 4.2-2.4 8.5-2.4V4.2c-4.3 0-6.9.8-8.5 2.4Z" />
      <path d="M12 6.6v13.8" />
    </>
  ),
  stats: (
    <>
      <path d="M3.5 21h17" />
      <path d="M7 21v-7.5M12 21V3.5M17 21v-11" />
    </>
  ),
  advices: (
    <>
      <path d="M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2v1h5v-1c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3Z" />
      <path d="M9.5 19.5h5M10.5 21.5h3" />
    </>
  ),
} as const;

export type NavIconKey = keyof typeof ICON;
