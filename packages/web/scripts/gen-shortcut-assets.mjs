#!/usr/bin/env node
// One-off generator for the manifest's presentation assets (B-259). Run manually:
//   npm run gen:pwa-assets -w @macronome/web
// The outputs are COMMITTED under public/, exactly like the icons from `gen:icons`, so CI and
// the Docker build never need `sharp` (it only exists here via @vite-pwa/assets-generator).
//
// Two jobs:
//  1. Taskbar shortcut icons — icons/shortcut-*.svg → public/shortcuts/*.png at 96px. Windows
//     otherwise falls back to the app icon for all five entries, so the jump list is unreadable.
//  2. Install-dialog screenshots — the README previews are 3838px / ~900KB, which is far more
//     than a dialog thumbnail needs. Downscaled to 1280px AND re-encoded to WebP: PNG compresses
//     a UI screenshot poorly (1280px PNG still came to ~580KB for the three), WebP brings the set
//     to a fraction of that. vite.config.ts also keeps them OUT of the service-worker precache:
//     they are seen once, at install time, and would otherwise bloat every visit.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const web = join(dirname(fileURLToPath(import.meta.url)), '..');
const repo = join(web, '..', '..');

const ICON_PX = 96;
const SHOT_WIDTH = 1280;

async function shortcutIcons() {
  const src = join(web, 'icons');
  const out = join(web, 'public', 'shortcuts');
  mkdirSync(out, { recursive: true });
  const files = readdirSync(src).filter((f) => f.startsWith('shortcut-') && f.endsWith('.svg'));
  for (const file of files) {
    const png = file.replace(/\.svg$/, '.png');
    await sharp(readFileSync(join(src, file)))
      .resize(ICON_PX, ICON_PX)
      .png()
      .toFile(join(out, png));
    console.log(`shortcut icon  ${png}  ${ICON_PX}×${ICON_PX}`);
  }
}

async function screenshots() {
  const out = join(web, 'public', 'screenshots');
  mkdirSync(out, { recursive: true });
  const sizes = {};
  for (const name of ['preview.png', 'preview_pc.png', 'preview_mobile.png']) {
    const webp = name.replace(/\.png$/, '.webp');
    const buffer = await sharp(join(repo, 'docs', 'img', name))
      // `withoutEnlargement` so a source smaller than the cap is copied, never upscaled.
      .resize({ width: SHOT_WIDTH, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    writeFileSync(join(out, webp), buffer);
    const meta = await sharp(buffer).metadata();
    sizes[webp] = `${meta.width}x${meta.height}`;
    console.log(`screenshot     ${webp}  ${sizes[webp]}  ${Math.round(buffer.length / 1024)}KB`);
  }
  // The manifest must state each screenshot's real pixel size; print them so vite.config.ts can
  // be updated deliberately rather than from memory.
  console.log('\nmanifest `sizes` values:', JSON.stringify(sizes, null, 2));
}

await shortcutIcons();
await screenshots();
