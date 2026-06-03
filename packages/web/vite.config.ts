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
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
  },
});
