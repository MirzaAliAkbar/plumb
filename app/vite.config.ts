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
        path.resolve(import.meta.dirname, 'src/sw-source.js'),
        'utf8',
      );
      const assets = Object.keys(bundle).filter(
        (f) => !f.endsWith('.map') && !f.endsWith('sw.js'),
      );
      // The standard-font files are precached with the shell: they are small and
      // are needed by the most ordinary documents (any PDF that uses a
      // non-embedded Helvetica or Times). CMaps and the image-codec wasm files
      // are far larger and only matter for CJK and scanned-image pages, so those
      // are runtime-cached on first use instead.
      const fontDir = path.resolve(import.meta.dirname, 'node_modules/pdfjs-dist/standard_fonts');
      const fonts = fs.existsSync(fontDir)
        ? fs.readdirSync(fontDir).map((f) => `/pdfjs/standard_fonts/${f}`)
        : [];
      const urls = ['/', '/index.html', ...assets.map((f) => `/${f}`), ...fonts];
      const manifest = `self.__PLUMB_PRECACHE__ = ${JSON.stringify([...new Set(urls)])};\n`;
      // Bump on every build so a returning browser drops the previous shell
      // instead of serving a stale one. The version is derived from the asset
      // hashes, so identical output keeps the same cache.
      const version = assets
        .map((f) => f.replace(/[^a-zA-Z0-9]/g, ''))
        .join('')
        .slice(0, 40);

      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: `self.__PLUMB_VERSION__ = ${JSON.stringify(version)};\n` + manifest + source,
      });
    },
  };
}

/**
 * Ships pdf.js's auxiliary data files next to the app.
 *
 * Without these, pdf.js logs "Ensure that the `standardFontDataUrl` API parameter
 * is provided" and silently degrades: CJK text decodes to garbage (no CMaps), and
 * documents that rely on non-embedded standard fonts lose glyph widths. They are
 * not optional niceties — they are part of reading a real-world PDF correctly.
 *
 * Dev serves them straight out of node_modules through a middleware; the build
 * copies them into `dist/pdfjs/` so the static host serves them like any asset.
 */
function pdfjsData(): Plugin {
  const DIRS = ['cmaps', 'standard_fonts', 'wasm', 'iccs'];
  const root = path.resolve(import.meta.dirname, 'node_modules/pdfjs-dist');

  return {
    name: 'plumb-pdfjs-data',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '').split('?')[0];
        if (!url.startsWith('/pdfjs/')) return next();
        const rel = decodeURIComponent(url.slice('/pdfjs/'.length));
        const file = path.resolve(root, rel);
        // Never serve outside the pdfjs-dist package.
        if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) {
          res.statusCode = 404;
          res.end('Not found');
          return;
        }
        const ext = path.extname(file);
        const type =
          ext === '.wasm'
            ? 'application/wasm'
            : ext === '.pfb' || ext === '.ttf'
              ? 'font/otf'
              : 'application/octet-stream';
        res.setHeader('Content-Type', type);
        fs.createReadStream(file).pipe(res);
      });
    },
    closeBundle() {
      const out = path.resolve(import.meta.dirname, 'dist/pdfjs');
      for (const dir of DIRS) {
        const from = path.join(root, dir);
        if (!fs.existsSync(from)) continue;
        fs.cpSync(from, path.join(out, dir), { recursive: true });
      }
    },
  };
}

/**
 * Two compatibility fixes for `mespeak` (the offline read-aloud fallback):
 *
 * 1. Its generated `ESpeak.js` is Latin-1 — it has literal 0xC0/0xD6 bytes in
 *    comments. Rolldown refuses to read it as UTF-8, so load it with the right
 *    encoding. The code itself is ASCII; only comments differ.
 * 2. `index.js` registers a `window` `unload` listener, which Chrome reports as a
 *    permissions-policy violation. It only flips an internal flag during
 *    navigation, which this SPA never needs, so drop it.
 */
function mespeakCompat(): Plugin {
  return {
    name: 'mespeak-compat',
    enforce: 'pre',
    load(id) {
      const clean = id.split('?')[0];
      if (clean.endsWith('mespeak/src/ESpeak.js')) {
        return fs.readFileSync(clean, 'latin1');
      }
      return null;
    },
    transform(code, id) {
      const clean = id.split('?')[0];
      if (clean.endsWith('mespeak/src/index.js')) {
        return code.replace(
          /if \(typeof window !== 'undefined'\)\s*window\.addEventListener\('unload',\s*unloadHandler,\s*false\);/g,
          '',
        );
      }
      return null;
    },
  };
}

// Static, offline-capable build, served from the host root so client-side
// routes (/app, /library) resolve without a rewrite on every asset request.
export default defineConfig({
  base: '/',
  plugins: [react(), mespeakCompat(), pdfjsData(), serviceWorker()],
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    sourcemap: false,
    // The offline read-aloud fallback (eSpeak compiled to JS) is a deliberately
    // large, lazily-loaded chunk. It only downloads when read-aloud is first
    // used, so the size warning is expected rather than a problem.
    chunkSizeWarningLimit: 1800,
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
