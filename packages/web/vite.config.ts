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
    // Bind the dev server to IPv4 loopback explicitly. The default `localhost` binds
    // IPv6 (::1) only here; the browser then wastes ~2s per new connection failing on
    // 127.0.0.1 (Happy Eyeballs) before falling back. A single IPv4 address removes the
    // dead address and the stall. Open the app via http://127.0.0.1:5173 (macronome_start.bat).
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:3000', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
  },
});
