/* Atlas Work Orders - offline service worker */
const CACHE = "atlas-wo-v16";

const ASSETS = [
  "./",
  "./index.html",
  "./icon-180.png",
  "./icon-512.png",
  "./manifest.webmanifest",
  "https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.production.min.js",
  "https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom.production.min.js",
  "https://cdn.jsdelivr.net/npm/@babel/standalone@7.24.7/babel.min.js",
];

// Add one asset, falling back to a no-cors (opaque) fetch for cross-origin files.
async function addOne(cache, url) {
  try {
    const res = await fetch(url, { cache: "reload" });
    if (res && (res.ok || res.type === "opaque")) {
      await cache.put(url, res.clone());
      return true;
    }
  } catch (e) {
    /* fall through */
  }
  try {
    const res2 = await fetch(url, { mode: "no-cors", cache: "reload" });
    if (res2) {
      await cache.put(url, res2.clone());
      return true;
    }
  } catch (e) {
    /* give up on this asset */
  }
  return false;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const results = await Promise.all(ASSETS.map((u) => addOne(cache, u)));
      const ok = results.filter(Boolean).length;
      self.skipWaiting();
      // Tell any open pages whether we got everything.
      const clients = await self.clients.matchAll({ includeUncontrolled: true });
      clients.forEach((c) =>
        c.postMessage({ type: "precache", cached: ok, total: ASSETS.length })
      );
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);

      // Cache first - this is what makes it work with no signal.
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;

      try {
        const res = await fetch(req);
        // Stash a copy for next time (same-origin and CDN alike).
        if (res && (res.ok || res.type === "opaque")) {
          cache.put(req, res.clone()).catch(() => {});
        }
        return res;
      } catch (e) {
        // Offline and not cached: for page loads, serve the app shell.
        if (req.mode === "navigate") {
          const shell = (await cache.match("./index.html")) || (await cache.match("./"));
          if (shell) return shell;
        }
        throw e;
      }
    })()
  );
});
