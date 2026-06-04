#!/usr/bin/env node
// Prisma ↔ DDL contract alignment gate (docs/architecture/testing.md §5).
//
// Parses the authoritative table definitions in spec/schema/*.md and the second
// copy in packages/api/prisma/schema.prisma, then fails (exit 1) on drift for any
// table that IS implemented in Prisma: an unknown table/column, or a nullability
// mismatch. Tables not yet implemented are fine (added milestone by milestone).
//
// Whitelisted (legitimately live in migration SQL, not in schema.prisma): the
// `unaccent`/`pg_trgm` extensions, GIN trigram indexes, and the connect-pg-simple
// `session` table. Those never appear as Prisma models, so they cannot register.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA_DIR = join(root, 'spec', 'schema');
const PRISMA_FILE = join(root, 'packages', 'api', 'prisma', 'schema.prisma');
const WHITELIST_TABLES = new Set(['session']);
const ALWAYS_NOT_NULL = new Set(['created_at', 'updated_at']);

const camelToSnake = (s) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

/** Parse the markdown column tables from spec/schema/*.md → Map<table, Map<col, {notNull}>>. */
function parseContract() {
  const tables = new Map();
  for (const file of readdirSync(SCHEMA_DIR).filter((f) => f.endsWith('.md'))) {
    const lines = readFileSync(join(SCHEMA_DIR, file), 'utf8').split(/\r?\n/);
    let current = null;
    for (const line of lines) {
      // A table heading is a lowercase snake_case name, optionally followed by a
      // parenthetical note (e.g. "## leftover_group  (OPEN_GAPS #13)"). Prose section
      // headings start uppercase or contain spaces, so they never match.
      const heading = line.match(/^##\s+([a-z][a-z0-9_]*)\s*(?:\(.*\))?\s*$/);
      if (heading) {
        current = heading[1];
        if (!tables.has(current)) tables.set(current, new Map());
        continue;
      }
      if (!current || !line.startsWith('|')) continue;
      const cells = line.split('|').slice(1, -1).map((c) => c.trim());
      if (cells.length < 3) continue;
      const [colCell, typeCell, notes] = cells;
      if (!colCell || colCell.toLowerCase() === 'column' || /^-+$/.test(colCell)) continue;
      for (const name of colCell.split(',').map((c) => c.trim()).filter(Boolean)) {
        if (!/^[a-z][a-z0-9_]*$/.test(name)) continue;
        const notNull =
          /NOT NULL/i.test(notes) ||
          /\bPK\b/.test(`${typeCell} ${notes}`) ||
          ALWAYS_NOT_NULL.has(name);
        tables.get(current).set(name, { notNull });
      }
    }
  }
  return tables;
}

/** Parse prisma models → [{ table, columns: [{name, notNull}] }].
 *  Line-based block scan (robust against inner braces like @default("{}")). */
function parsePrisma() {
  const lines = readFileSync(PRISMA_FILE, 'utf8').split(/\r?\n/);
  const models = [];
  let model = null;
  let modelName = '';
  let columns = [];
  let table = '';
  for (const raw of lines) {
    const line = raw.trim();
    const open = line.match(/^model\s+(\w+)\s*\{/);
    if (open) {
      model = open[1];
      modelName = open[1];
      columns = [];
      table = '';
      continue;
    }
    if (model === null) continue;
    if (line === '}') {
      models.push({ table: table || camelToSnake(modelName).replace(/^_/, ''), columns });
      model = null;
      continue;
    }
    if (!line || line.startsWith('//')) continue;
    const mapMatch = line.match(/@@map\("([^"]+)"\)/);
    if (mapMatch) {
      table = mapMatch[1];
      continue;
    }
    if (line.startsWith('@@')) continue;
    const field = line.match(/^(\w+)\s+(\w+)(\?)?/);
    if (!field) continue;
    const colMap = line.match(/@map\("([^"]+)"\)/);
    const name = colMap ? colMap[1] : camelToSnake(field[1]);
    columns.push({ name, notNull: !field[3] });
  }
  return models;
}

function main() {
  const contract = parseContract();
  const models = parsePrisma();
  const drift = [];

  for (const { table, columns } of models) {
    if (WHITELIST_TABLES.has(table)) continue;
    const contractCols = contract.get(table);
    if (!contractCols) {
      drift.push(`table "${table}" is in schema.prisma but not in the DDL contract`);
      continue;
    }
    for (const col of columns) {
      const def = contractCols.get(col.name);
      if (!def) {
        drift.push(`column "${table}.${col.name}" is in schema.prisma but not in the contract`);
        continue;
      }
      if (def.notNull !== col.notNull) {
        drift.push(
          `nullability mismatch on "${table}.${col.name}": ` +
            `contract ${def.notNull ? 'NOT NULL' : 'NULL'} vs prisma ${col.notNull ? 'NOT NULL' : 'NULL'}`,
        );
      }
    }
  }

  if (drift.length) {
    console.error('check:schema FAILED — Prisma ↔ DDL contract drift:');
    for (const d of drift) console.error(`  • ${d}`);
    process.exit(1);
  }
  const tableCount = models.filter((m) => !WHITELIST_TABLES.has(m.table)).length;
  console.log(`check:schema OK — ${tableCount} Prisma table(s) match the DDL contract.`);
}

main();
