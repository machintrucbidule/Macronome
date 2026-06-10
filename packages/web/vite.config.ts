import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// SPA build. Dev server proxies /api → the local API (ops.md §3).
// @macronome/shared is aliased to source so dev needs no prebuild.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@macronome/shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)),
    },
  },
  server: {
    // Bind on all IPv4 interfaces (loopback + LAN), IPv4-only — we do NOT bind ::1.
    // Why: `localhost` resolves to both 127.0.0.1 AND ::1; binding ::1 only (Vite's
    // default) wasted ~2s per new connection (Happy Eyeballs racing the dead IPv4).
    // IPv4-only means every live address is unique → no stall, and the server is now
    // reachable from the local network (mobile testing). RULE: enter via
    // http://127.0.0.1:5173 (dev machine) or http://<LAN-IP>:5173 (phone) — NEVER via
    // `localhost`, which would still race on the dead ::1.
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:3000', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
  },
});
