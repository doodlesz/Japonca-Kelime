const CACHE_NAME = 'mainichibi-v1';
const ASSETS = [
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=Shippori+Mincho:wght@400;600;700&display=swap'
];

// ── Install: cache all assets ──────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS.filter(a => !a.startsWith('http')));
    })
  );
  self.skipWaiting();
});

// ── Activate: clean old caches ─────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: cache-first for local, network-first for CDN ─
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) {
    // network first for external (fonts etc.)
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      });
    })
  );
});

// ── Push Notifications ─────────────────────────────────
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || '🎌 Günlük Japonca';
  const options = {
    body: data.body || 'Bugünün 5 kelimesi seni bekliyor!',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [100, 50, 100],
    data: { url: '/index.html' },
    actions: [
      { action: 'open',    title: 'Kelimeleri Gör' },
      { action: 'dismiss', title: 'Daha Sonra'     }
    ]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification Click ─────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes('index.html') && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/index.html');
    })
  );
});

// ── Background Sync (günlük bildirim zamanlama) ────────
self.addEventListener('periodicsync', event => {
  if (event.tag === 'daily-words') {
    event.waitUntil(sendDailyNotification());
  }
});

async function sendDailyNotification() {
  await self.registration.showNotification('🎌 Bugünün Japonca Kelimeleri Hazır!', {
    body: 'Her gün 5 yeni kelime — bugününü kaçırma!',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [100, 50, 100],
    data: { url: '/index.html' }
  });
}
