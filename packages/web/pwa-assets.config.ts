import { defineConfig } from '@vite-pwa/assets-generator/config';

// One-off PWA icon generation (PWA-1, ADR-0003). Run manually via `npm run gen:icons -w
// @macronome/web`; the PNGs are committed under public/ so CI and the Docker build need no
// `sharp`. Source = public/icon.svg (the validated mark: transparent exterior, dark inner
// disc, thicker amber ring + needle) — FULL-BLEED since B-196 (mark ≈ 94% of the canvas).
// The maskable + apple variants composite the mark on the dark brand background (#0d0f12) so
// they are opaque; their paddings are COMPENSATED for the full-bleed source so the rendered
// mark size matches the pre-B-196 icons: old mark 0.652×(1−0.3)=0.457 of the maskable canvas
// → new 0.9375×(1−0.5)=0.469; apple old 0.652×0.9=0.587 → new 0.9375×(1−0.37)=0.591. The
// plain pwa-* icons stay transparent with padding 0 (that is the point of B-196).
// The existing favicon.svg / favicon.ico are NOT regenerated (no `favicons` entry).
const DARK = '#0d0f12';

export default defineConfig({
  images: ['public/icon.svg'],
  preset: {
    transparent: { sizes: [64, 192, 512], favicons: [] },
    maskable: { sizes: [512], padding: 0.5, resizeOptions: { background: DARK } },
    apple: { sizes: [180], padding: 0.37, resizeOptions: { background: DARK } },
  },
});
