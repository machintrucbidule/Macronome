import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildCatalogMacros,
  CIQUAL_CONST,
  parseTeneur,
  type CiqualSeedEntry,
  type CiqualSeedFile,
} from '../src/domain/ciqual/index.js';
import { findCiqualFiles, readRecords } from './ciqual-xml.js';

// Offline generator for the committed Ciqual extract (spec/logic/ciqual-catalog.md).
// Re-runnable against a future edition: point --dir at the new distribution, bump DATASET.
//
//   npm run build:ciqual -w @macronome/api -- --dir ../../specifications/ciqual-2025
//
// Reads the four XML files, applies the §3/§4 rules (which live in domain/ciqual, so the
// server and this script cannot drift), and writes data/<dataset>.json with one entry per
// line — a future edition then produces a reviewable diff. The raw XML is never committed.

const DATASET = 'ciqual_2025';
const SOURCE =
  'Ciqual 2025 (2025-11-03) — Anses, Table de composition nutritionnelle des aliments. ' +
  'Licence Ouverte / Open Licence 2.0 (Etalab). doi:10.57745/RDMHWY';

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_DIR = resolve(apiRoot, '../../specifications/ciqual-2025');

// §5 — one 2025 food carries the sentinel group code `00`, which the group table does not
// declare. Its composition is fully published, so it is labelled rather than dropped.
const UNCLASSIFIED = { fr: 'non classé', eng: 'unclassified' };

interface Food {
  code: string;
  nameFr: string;
  nameEng: string;
  groupCode: string;
}

/** Level-1 group labels, keyed by `alim_grp_code`. The file is denormalised — first row wins. */
async function readGroups(file: string): Promise<Map<string, { fr: string; eng: string }>> {
  const groups = new Map<string, { fr: string; eng: string }>();
  for await (const r of readRecords(file, 'ALIM_GRP')) {
    const code = r.alim_grp_code;
    if (!code || groups.has(code)) continue;
    groups.set(code, { fr: r.alim_grp_nom_fr ?? '', eng: r.alim_grp_nom_eng ?? '' });
  }
  return groups;
}

async function readFoods(file: string): Promise<Food[]> {
  const foods: Food[] = [];
  for await (const r of readRecords(file, 'ALIM')) {
    const code = r.alim_code;
    const nameFr = r.alim_nom_fr;
    const groupCode = r.alim_grp_code;
    if (!code || !nameFr || !groupCode) continue;
    // alim_nom_eng is present on every row of the 2025 edition; fall back rather than drop.
    foods.push({ code, nameFr, nameEng: r.alim_nom_eng ?? nameFr, groupCode });
  }
  return foods;
}

type RawValues = Record<string, string>;

/** Collect only the four constituents of §2, keyed by food code. */
async function readComposition(file: string): Promise<Map<string, RawValues>> {
  const wanted = new Map(Object.entries(CIQUAL_CONST).map(([k, code]) => [code as string, k]));
  const byFood = new Map<string, RawValues>();
  for await (const r of readRecords(file, 'COMPO')) {
    const key = r.const_code === undefined ? undefined : wanted.get(r.const_code);
    if (key === undefined || !r.alim_code) continue;
    const entry = byFood.get(r.alim_code) ?? {};
    entry[key] = r.teneur ?? '-';
    byFood.set(r.alim_code, entry);
  }
  return byFood;
}

/** Fail loudly if the edition renamed or dropped one of the four constituents we read. */
async function assertConstituents(file: string): Promise<void> {
  const seen = new Set<string>();
  for await (const r of readRecords(file, 'CONST')) {
    if (r.const_code) seen.add(r.const_code);
  }
  const missing = Object.values(CIQUAL_CONST).filter((code) => !seen.has(code));
  if (missing.length) {
    throw new Error(`Constituent code(s) absent from this edition: ${missing.join(', ')}`);
  }
}

function argDir(): string {
  const argv = process.argv.slice(2);
  const i = argv.indexOf('--dir');
  const given = i >= 0 ? argv[i + 1] : undefined;
  return given ? resolve(process.cwd(), given) : DEFAULT_DIR;
}

/** Serialise with one entry per line: valid JSON, and a readable diff between editions. */
function serialise(file: CiqualSeedFile): string {
  const head = `{\n"dataset": ${JSON.stringify(file.dataset)},\n"source": ${JSON.stringify(file.source)},\n"entries": [\n`;
  const rows = file.entries.map((e) => JSON.stringify(e)).join(',\n');
  return `${head}${rows}\n]\n}\n`;
}

async function main(): Promise<void> {
  const dir = argDir();
  const files = await findCiqualFiles(dir);
  console.log(`Reading ${dir}`);

  await assertConstituents(files.const);
  const groups = await readGroups(files.alimGrp);
  const foods = await readFoods(files.alim);
  const composition = await readComposition(files.compo);
  console.log(
    `  ${foods.length} foods, ${groups.size} groups, ${composition.size} with composition`,
  );

  const entries: CiqualSeedEntry[] = [];
  let derived = 0;
  let dropped = 0;
  let unclassified = 0;
  for (const food of foods) {
    const group = groups.get(food.groupCode);
    if (!group) unclassified += 1;
    const label = group ?? UNCLASSIFIED;
    const raw = composition.get(food.code) ?? {};
    const macros = buildCatalogMacros(
      {
        kcal: parseTeneur(raw.kcal ?? '-'),
        fat: parseTeneur(raw.fat ?? '-'),
        carb: parseTeneur(raw.carb ?? '-'),
        protein: parseTeneur(raw.protein ?? '-'),
      },
      food.groupCode,
    );
    if (!macros) {
      dropped += 1;
      continue;
    }
    if (macros.energyDerived) derived += 1;
    entries.push({
      code: food.code,
      name_fr: food.nameFr,
      name_eng: food.nameEng,
      group_fr: label.fr,
      group_eng: label.eng,
      kcal: macros.kcalPer100g,
      fat: macros.fatPer100g,
      carb: macros.carbPer100g,
      protein: macros.proteinPer100g,
      derived: macros.energyDerived,
    });
  }

  entries.sort((a, b) => a.code.localeCompare(b.code));
  const out = resolve(apiRoot, 'data', `${DATASET}.json`);
  await writeFile(out, serialise({ dataset: DATASET, source: SOURCE, entries }), 'utf8');
  console.log(
    `Wrote ${entries.length} entries (${derived} with derived energy, ${dropped} dropped, ` +
      `${unclassified} unclassified group) → ${out}`,
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
