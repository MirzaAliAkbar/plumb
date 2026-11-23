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
 *
 * The second non-obvious thing is cache staleness. An HTML document served
 * cache-first pins a returning visitor to whatever build they first loaded, and
 * no later deploy can reach them. Navigations are therefore network-first, with
 * the cached shell only as the offline fallback. Hashed assets stay cache-first,
 * which is safe by construction: a new build produces new filenames.
 */

/** Version injected at build time from the asset hashes. */
const VERSION = self.__PLUMB_VERSION__ ?? 'dev';
const CACHE = `plumb-assets-${VERSION}`;

/** Asset URLs injected at build time (see vite.config.ts). */
const PRECACHE = self.__PLUMB_PRECACHE__ ?? ['/', '/index.html'];

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
      // Every previous build's cache goes, not just non-matching names: a stale
      // shell is the one failure this worker must never cause.
      await Promise.all(
        keys
          .filter((k) => k.startsWith('plumb-assets-') && k !== CACHE)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: always try the network first, so a deploy reaches the user on
  // their next visit. The cached shell is the offline fallback only.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          if (fresh.ok) {
            const cache = await caches.open(CACHE);
            cache.put('/index.html', fresh.clone());
          }
          return fresh;
        } catch {
          const cache = await caches.open(CACHE);
          const shell =
            (await cache.match('/index.html', { ignoreVary: true })) ??
            (await cache.match('/', { ignoreVary: true }));
          return shell ?? new Response('Offline', { status: 503, statusText: 'Offline' });
        }
      })(),
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      // `ignoreVary` matters: module scripts and other CORS-mode fetches send an
      // `Origin` header, and the host answers assets with `Vary: Origin`. The
      // precached copy was stored from a fetch with no `Origin`, so a strict
      // match misses every asset when offline. These are immutable same-origin
      // files, so the `Vary` axis is not a real distinction here.
      const cached = await cache.match(request, { ignoreSearch: true, ignoreVary: true });
      if (cached) return cached;

      try {
        const fresh = await fetch(request);
        // Only cache successful basic responses; an error page cached here
        // would poison the app silently on the next offline load.
        if (fresh.ok && fresh.type === 'basic') {
          cache.put(request, fresh.clone());
        }
        return fresh;
      } catch {
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      }
    })(),
  );
});
