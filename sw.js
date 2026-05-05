// Service worker temporarily disabled.
// This file exists only to unregister itself for users who installed an earlier version,
// so they aren't stuck on stale cached files. We'll restore the real service worker
// once the visual design is dialed in.
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Wipe all caches
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    // Unregister this worker
    await self.registration.unregister();
    // Force all open pages to reload so they fetch fresh from network
    const clientsList = await self.clients.matchAll();
    clientsList.forEach((client) => client.navigate(client.url));
  })());
});
