import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  base: '/poop-fling/',
  server: { port: 3000, open: true },
  build: { outDir: 'dist' },
});
