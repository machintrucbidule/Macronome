#!/usr/bin/env node
// i18n key-coverage gate (DEV_PLAN M9 — i18n completeness). The web ships FR + EN; every
// translation key must exist in both locales. Fails (exit 1) on any key present in one
// locale but missing from the other, so a half-translated feature can't merge. Numbers and
// dates are localised via Intl (design/theming.md §2), not i18next — they are not keys here.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOCALES_DIR = join(root, 'packages', 'web', 'src', 'i18n', 'locales');
const LOCALES = ['fr', 'en'];

/** Flatten a nested translation object to dotted leaf keys. */
function flatten(obj, prefix = '') {
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) keys.push(...flatten(v, path));
    else keys.push(path);
  }
  return keys;
}

const keysByLocale = new Map();
for (const locale of LOCALES) {
  const json = JSON.parse(readFileSync(join(LOCALES_DIR, `${locale}.json`), 'utf8'));
  keysByLocale.set(locale, new Set(flatten(json)));
}

const problems = [];
for (const a of LOCALES) {
  for (const b of LOCALES) {
    if (a === b) continue;
    for (const key of keysByLocale.get(a)) {
      if (!keysByLocale.get(b).has(key)) problems.push(`  - "${key}" is in ${a} but missing from ${b}`);
    }
  }
}

if (problems.length > 0) {
  console.error(`i18n key mismatch between locales (${LOCALES.join(', ')}):`);
  console.error([...new Set(problems)].sort().join('\n'));
  process.exit(1);
}

console.log(`i18n OK — ${keysByLocale.get('fr').size} keys, locales in sync (${LOCALES.join(', ')}).`);
