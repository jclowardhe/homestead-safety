// Homestead Electric Safety — Service Worker
// Bump CACHE_VERSION when you ship a new index.html so users get the update.
const CACHE_VERSION = 'hes-safety-v3';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './skull.png',
  './logo.png',
  './app-icon-192.png',
  './app-icon-512.png',
  './app-icon-512-maskable.png',
  // CDN dependencies — cached on first successful fetch
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
];

// On install: pre-cache the app shell so the app boots offline.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      // addAll is atomic — if any URL fails, install fails. Use add() per-URL so a flaky CDN doesn't block install.
      Promise.allSettled(APP_SHELL.map((url) => cache.add(url).catch(() => null)))
    ).then(() => self.skipWaiting())
  );
});

// On activate: clear out old cache versions.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy:
//   - Supabase REST/Realtime calls: network-only (never cache live data)
//   - Everything else (HTML, scripts, fonts, images): cache-first with network fallback
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Skip Supabase API and realtime — always live
  if (url.hostname.endsWith('.supabase.co') || url.hostname.endsWith('.supabase.in')) {
    return; // let the browser handle it normally
  }
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        // Refresh in the background so next load gets newer asset (stale-while-revalidate)
        fetch(req).then((res) => {
          if (res && res.ok) {
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, res.clone()));
          }
        }).catch(() => {});
        return cached;
      }
      return fetch(req).then((res) => {
        if (res && res.ok && (req.url.startsWith(self.location.origin) || url.hostname.includes('jsdelivr') || url.hostname.includes('googleapis') || url.hostname.includes('gstatic'))) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => {
        // Last resort: serve cached index for navigation requests so the app shell shows offline
        if (req.mode === 'navigate') return caches.match('./index.html');
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      });
    })
  );
});
