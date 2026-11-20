/**
 * Offline support.
 *
 * The promise is "works offline after the first load". That matters here beyond
 * convenience: a student on a train, or on a locked-down library machine, should
 * not need a working connection to read a document they already have.
 *
 * Getting this right needed one non-obvious thing. pdf.js loads its worker, and
 * the worker pulls its own font data, lazily — only when a document is first
 * opened. Caching purely on demand therefore leaves the app in a state where the
 * shell loads offline but extraction fails, which is worse than no offline
 * support at all. So we warm the cache at install time from the build manifest.
 */

const CACHE = 'plumb-assets-v1';

/** Asset URLs injected at build time (see vite.config.ts). */
const PRECACHE = self.__PLUMB_PRECACHE__ ?? ['./', './index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // Add individually so one 404 cannot fail the whole install.
      await Promise.all(
        PRECACHE.map(async (url) => {
          try {
            const res = await fetch(url, { cache: 'reload' });
            if (res.ok) await cache.put(url, res);
          } catch {
            /* a missing optional asset must not abort installation */
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request, { ignoreSearch: true });

      const network = fetch(request)
        .then((response) => {
          // Only cache successful basic responses; an error page cached here
          // would poison the app silently on the next offline load.
          if (response.ok && response.type === 'basic') {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => null);

      if (cached) {
        event.waitUntil(network);
        return cached;
      }

      const fresh = await network;
      if (fresh) return fresh;

      // Offline and uncached: serve the app shell for navigations so the UI
      // loads instead of the browser's error page.
      if (request.mode === 'navigate') {
        const shell = await cache.match('./index.html');
        if (shell) return shell;
      }
      return new Response('Offline', { status: 503, statusText: 'Offline' });
    })(),
  );
});
