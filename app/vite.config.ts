import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Emits the service worker with the built asset list injected.
 *
 * Two things make this necessary rather than nice-to-have:
 *
 * 1. The worker cannot know the hashed filenames at author time.
 * 2. pdf.js fetches its worker — and the worker fetches font data — lazily, only
 *    when a document is first opened. Caching on demand therefore leaves the app
 *    in a state where the shell loads offline but extraction fails, which is
 *    worse than having no offline support at all.
 *
 * So the worker is generated here, with every built asset listed for precache.
 */
function serviceWorker(): Plugin {
  return {
    name: 'plumb-service-worker',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const source = fs.readFileSync(
        path.resolve(__dirname, 'src/sw-source.js'),
        'utf8',
      );
      const assets = Object.keys(bundle).filter(
        (f) => !f.endsWith('.map') && !f.endsWith('sw.js'),
      );
      const urls = ['./', './index.html', ...assets.map((f) => `./${f}`)];
      const manifest = `self.__PLUMB_PRECACHE__ = ${JSON.stringify(urls)};\n`;

      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: manifest + source,
      });
    },
  };
}

// Static, offline-capable build. `base: './'` keeps it working on GitHub Pages
// project paths and on any static host without server rewrites.
export default defineConfig({
  base: './',
  plugins: [react(), serviceWorker()],
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1400,
    rollupOptions: {
      output: {
        // pdf.js is large; keep it in its own chunk so first paint is fast.
        manualChunks(id) {
          if (id.includes('pdfjs-dist')) return 'pdfjs';
          return undefined;
        },
      },
    },
  },
});
