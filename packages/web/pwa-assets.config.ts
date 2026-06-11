import { defineConfig } from '@vite-pwa/assets-generator/config';

// One-off PWA icon generation (PWA-1, ADR-0003). Run manually via `npm run gen:icons -w
// @macronome/web`; the PNGs are committed under public/ so CI and the Docker build need no
// `sharp`. Source = public/icon.svg (the validated mark: transparent exterior, dark inner
// disc, thicker amber ring + needle). The maskable + apple variants composite the mark on the
// dark brand background (#0d0f12) so they are opaque; the plain pwa-* icons stay transparent.
// The existing favicon.svg / favicon.ico are NOT regenerated (no `favicons` entry).
const DARK = '#0d0f12';

export default defineConfig({
  images: ['public/icon.svg'],
  preset: {
    transparent: { sizes: [64, 192, 512], favicons: [] },
    maskable: { sizes: [512], padding: 0.3, resizeOptions: { background: DARK } },
    apple: { sizes: [180], padding: 0.1, resizeOptions: { background: DARK } },
  },
});
