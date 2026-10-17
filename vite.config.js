import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  base: './',
  define: { __DEBUG__: JSON.stringify(mode !== 'production') },
  server: { port: 5310 },
  preview: { port: 5311 },
  test: { include: ['tests/unit/**/*.test.js'] },
}));
