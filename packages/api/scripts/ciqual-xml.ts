import { createReadStream } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

// Streaming reader for the Ciqual XML distribution (spec/logic/ciqual-catalog.md §1).
// Offline, generator-only: nothing here runs in the server.
//
// The format is rigidly line-oriented — `<TABLE>` root, one record per `<ALIM>`/`<COMPO>`/…
// block, exactly one field per line — so a line scanner reads the 69 MB composition file
// without holding it in memory and without pulling in an XML parser dependency. A malformed
// line is skipped rather than guessed at; the caller's completeness checks catch the fallout.

const OPEN_CLOSE = /^<([A-Za-z_][\w]*)>(.*)<\/\1>$/;

const ENTITIES: Record<string, string> = {
  '&lt;': '<',
  '&gt;': '>',
  '&apos;': "'",
  '&quot;': '"',
  '&amp;': '&',
};

/** Decode the five XML entities the distribution uses (`&amp;` last — order matters). */
function decode(text: string): string {
  return text.replace(/&(?:lt|gt|apos|quot|amp);/g, (m) => ENTITIES[m] ?? m);
}

/** A record's fields, trimmed and entity-decoded. A `missing=" "` element is simply absent. */
export type XmlRecord = Record<string, string>;

/** Yield every `<tag>…</tag>` record of `file`, one at a time. */
export async function* readRecords(file: string, tag: string): AsyncGenerator<XmlRecord> {
  const rl = createInterface({
    input: createReadStream(file, 'utf8'),
    crlfDelay: Infinity,
  });
  const open = `<${tag}>`;
  const close = `</${tag}>`;
  let current: XmlRecord | null = null;
  try {
    for await (const raw of rl) {
      const line = raw.trim();
      if (line === open) {
        current = {};
      } else if (line === close) {
        if (current) yield current;
        current = null;
      } else if (current) {
        const m = OPEN_CLOSE.exec(line);
        if (m?.[1] !== undefined && m[2] !== undefined) current[m[1]] = decode(m[2]).trim();
      }
    }
  } finally {
    rl.close();
  }
}

/** The four distribution files, whose names carry the edition date. */
export interface CiqualFiles {
  alim: string;
  alimGrp: string;
  const: string;
  compo: string;
}

const PATTERNS = {
  alimGrp: /^alim_grp_\d{4}_\d{2}_\d{2}\.xml$/,
  alim: /^alim_\d{4}_\d{2}_\d{2}\.xml$/,
  const: /^const_\d{4}_\d{2}_\d{2}\.xml$/,
  compo: /^compo_\d{4}_\d{2}_\d{2}\.xml$/,
} as const;

/** Locate the four files in `dir` by name pattern (the date is part of the filename). */
export async function findCiqualFiles(dir: string): Promise<CiqualFiles> {
  const names = await readdir(dir);
  const pick = (key: keyof typeof PATTERNS): string => {
    const hit = names.find((n) => PATTERNS[key].test(n));
    if (!hit) throw new Error(`No ${key} file matching ${String(PATTERNS[key])} in ${dir}`);
    return join(dir, hit);
  };
  return {
    alim: pick('alim'),
    alimGrp: pick('alimGrp'),
    const: pick('const'),
    compo: pick('compo'),
  };
}
