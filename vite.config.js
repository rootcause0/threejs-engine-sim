import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset URLs so the same build works at a domain root, at
  // https://<user>.github.io/<repo>/, or in a subfolder of any static host.
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900,
  },
});
