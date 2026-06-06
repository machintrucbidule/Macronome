// One-off, dependency-free generator for the ICO raster fallback favicon (B-011).
// NOT a build/CI step — run by hand when the brand geometry changes; the output
// `public/favicon.ico` is committed. Draws the same brand "tick" as `public/favicon.svg`
// (metronome ring + frozen needle, accent amber #e0b341) into a 32x32 32-bit BMP, supersampled
// for anti-aliasing, then wraps it in an ICO container.
//
//   node packages/web/scripts/gen-favicon.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SIZE = 32;
const SS = 8; // subsamples per axis
const ACCENT = { r: 0xe0, g: 0xb3, b: 0x41 };

// Geometry in the 32x32 space (mirrors favicon.svg).
const CX = 16,
  CY = 16,
  R = 12,
  HALF = 1.25; // half the 2.5px stroke
const NEEDLE = { ax: 16, ay: 16, bx: 11.55, by: 3.8 };

function distToSegment(px, py, { ax, ay, bx, by }) {
  const dx = bx - ax,
    dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function covered(px, py) {
  const d = Math.hypot(px - CX, py - CY);
  const ring = d >= R - HALF && d <= R + HALF;
  const needle = distToSegment(px, py, NEEDLE) <= HALF;
  return ring || needle;
}

// Build bottom-up BGRA pixel rows (BMP convention).
const xor = Buffer.alloc(SIZE * SIZE * 4);
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    let hit = 0;
    for (let j = 0; j < SS; j++) {
      for (let i = 0; i < SS; i++) {
        if (covered(x + (i + 0.5) / SS, y + (j + 0.5) / SS)) hit++;
      }
    }
    const alpha = Math.round((hit / (SS * SS)) * 255);
    const row = SIZE - 1 - y; // bottom-up
    const off = (row * SIZE + x) * 4;
    xor[off] = ACCENT.b;
    xor[off + 1] = ACCENT.g;
    xor[off + 2] = ACCENT.r;
    xor[off + 3] = alpha;
  }
}

// AND mask: 1bpp, rows padded to 4 bytes. All-zero (alpha channel does the masking).
const andMask = Buffer.alloc((Math.ceil(SIZE / 32) * 4) * SIZE, 0);

// BITMAPINFOHEADER (40 bytes); biHeight doubled (XOR + AND) per ICO BMP rules.
const header = Buffer.alloc(40);
header.writeUInt32LE(40, 0);
header.writeInt32LE(SIZE, 4);
header.writeInt32LE(SIZE * 2, 8);
header.writeUInt16LE(1, 12); // planes
header.writeUInt16LE(32, 14); // bit count
const bmp = Buffer.concat([header, xor, andMask]);

// ICONDIR (6) + ICONDIRENTRY (16).
const dir = Buffer.alloc(6);
dir.writeUInt16LE(0, 0);
dir.writeUInt16LE(1, 2); // type: icon
dir.writeUInt16LE(1, 4); // count
const entry = Buffer.alloc(16);
entry.writeUInt8(SIZE, 0); // width
entry.writeUInt8(SIZE, 1); // height
entry.writeUInt8(0, 2); // palette
entry.writeUInt16LE(1, 4); // planes
entry.writeUInt16LE(32, 6); // bit count
entry.writeUInt32LE(bmp.length, 8);
entry.writeUInt32LE(6 + 16, 12); // image offset

const ico = Buffer.concat([dir, entry, bmp]);
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'favicon.ico');
writeFileSync(out, ico);
console.log(`Wrote ${out} (${ico.length} bytes)`);
