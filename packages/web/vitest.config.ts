import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

// Reuse the Vite resolve aliases; component tests run under jsdom.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
      passWithNoTests: true,
    },
  }),
);
