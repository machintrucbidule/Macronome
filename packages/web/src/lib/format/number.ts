import i18n from '../../i18n/config';

// Locale-aware number display (design/theming.md §2: numbers via Intl.*). Single source for
// the per-feature format.ts helpers. Display only — never a nutrition computation (CLAUDE.md
// rule 2); the server sends full precision and the contract rounding (spec/logic/00-conventions
// §Rounding) is reproduced here. Intl rounds half-up ("halfExpand"), matching the contract.
//
// Grouping is OFF on purpose: this is a dense numeric tracker whose tables align on tabular
// figures, and the FR group separator is a narrow no-break space (a copy/paste & test hazard).
// So integers render identically across locales; only the decimal mark localises (FR "," / EN ".").

const cache = new Map<string, Intl.NumberFormat>();

function formatter(min: number, max: number): Intl.NumberFormat {
  const locale = i18n.language || 'fr';
  const key = `${locale}:${min}:${max}`;
  let nf = cache.get(key);
  if (!nf) {
    nf = new Intl.NumberFormat(locale, {
      minimumFractionDigits: min,
      maximumFractionDigits: max,
      useGrouping: false,
    });
    cache.set(key, nf);
  }
  return nf;
}

/** Integer display (e.g. kcal). Rounds half-up. */
export function formatInt(n: number): string {
  return formatter(0, 0).format(n);
}

/** Fixed number of decimals (e.g. weights/macros at 1 dp, ratios at 2 dp). Rounds half-up. */
export function formatFixed(n: number, digits: number): string {
  return formatter(digits, digits).format(n);
}

/** Up to `maxDigits` decimals, trailing zeros dropped (e.g. portion grams). Rounds half-up. */
export function formatUpTo(n: number, maxDigits: number): string {
  return formatter(0, maxDigits).format(n);
}
