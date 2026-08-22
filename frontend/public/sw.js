// Civicदृष्टि — offline service worker.
const CACHE_VERSION = 'govinsight-v3';
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`;
const API_CACHE = `${CACHE_VERSION}-api`;
const QUEUE_DB = 'govinsight-offline-queue';
const QUEUE_STORE = 'pending-requests';

const APP_SHELL_URLS = [
  '/',
  '/dashboard',
  '/manifest.json',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
];

// ---- IndexedDB helpers for the offline write queue ----
function openQueueDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(QUEUE_DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function queueRequest(entry) {
  const db = await openQueueDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readwrite');
    tx.objectStore(QUEUE_STORE).add(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getQueuedRequests() {
  const db = await openQueueDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readonly');
    const req = tx.objectStore(QUEUE_STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function deleteQueuedRequest(id) {
  const db = await openQueueDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readwrite');
    tx.objectStore(QUEUE_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---- install / activate ----
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !k.startsWith(CACHE_VERSION)).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then((clients) => clients.forEach((client) => client.postMessage({ type: 'sw-updated' })))
  );
});

// ---- fetch handling ----
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests.
  if (url.origin !== self.location.origin) return;

  const isApi = url.pathname.startsWith('/api/');
  const isReportWrite = isApi && url.pathname.startsWith('/api/reports') && request.method !== 'GET';
  // Identity/permissions must always come from the network. If a request
  // hiccup ever made the fetch() below reject, falling back to a cached
  // copy here would silently hand back a stale role (e.g. a user promoted
  // to admin still looking like a citizen) with no visible error -- which
  // is exactly the "works after hard refresh, not on normal load" bug
  // this endpoint was hitting. So it bypasses the service worker entirely.
  const isIdentity = isApi && url.pathname.startsWith('/api/auth/me');
  if (isIdentity) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(APP_SHELL_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
    );
    return;
  }

  // Queue report writes made while offline; replay them later via sync.
  if (isReportWrite) {
    event.respondWith(
      fetch(request.clone()).catch(async () => {
        const body = await request.clone().text();
        await queueRequest({
          url: request.url,
          method: request.method,
          headers: Object.fromEntries(request.headers.entries()),
          body,
          queuedAt: Date.now(),
        });
        if ('sync' in self.registration) {
          try { await self.registration.sync.register('sync-queued-reports'); } catch { /* ignore */ }
        }
        return new Response(
          JSON.stringify({ queued: true, offline: true, message: 'Saved offline — will submit automatically once you\u2019re back online.' }),
          { status: 202, headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // Network-first for other API GETs, fall back to cache when offline.
  if (isApi && request.method === 'GET') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(API_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Next.js build output (JS/CSS chunks) changes on every deploy but often
  // keeps the same URL in dev, and can be re-requested before a hard reload
  // clears any stale copy — so these must always be checked against the
  // network first. Falls back to cache only when truly offline.
  const isBuildAsset = url.pathname.startsWith('/_next/');
  if (isBuildAsset && request.method === 'GET') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(APP_SHELL_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Cache-first for everything else (icons, manifest, and other rarely
  // changing static assets).
  if (request.method === 'GET') {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request)
          .then((response) => {
            const copy = response.clone();
            caches.open(APP_SHELL_CACHE).then((cache) => cache.put(request, copy));
            return response;
          })
          .catch(() => caches.match('/dashboard'));
      })
    );
  }
});

// ---- background sync: replay queued report submissions ----
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-queued-reports') {
    event.waitUntil(replayQueuedRequests());
  }
});

// Fallback for browsers without Background Sync (e.g. iOS Safari): the app
// can call navigator.serviceWorker.controller.postMessage({type:'flush-queue'})
// on regaining connectivity (see LanguageContext-adjacent online listener in
// the app shell) to trigger the same replay logic manually.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'flush-queue') {
    event.waitUntil(replayQueuedRequests());
  }
});

async function replayQueuedRequests() {
  const queued = await getQueuedRequests();
  for (const entry of queued) {
    try {
      const response = await fetch(entry.url, {
        method: entry.method,
        headers: entry.headers,
        body: entry.body,
      });
      if (response.ok) {
        await deleteQueuedRequest(entry.id);
        const clients = await self.clients.matchAll();
        clients.forEach((client) => client.postMessage({ type: 'queued-report-synced', id: entry.id }));
      }
    } catch {
      // Still offline — leave it queued, try again on the next sync event.
      break;
    }
  }
}

// ---- push notifications ----
// Fires for report status updates (verified / assigned / resolved) sent
// from the server via web-push - see backend/utils/push.js. Delivered even
// when Civicदृष्टि isn't open, which is the whole point of a push
// notification versus an in-app one.
self.addEventListener('push', (event) => {
  let data = { title: 'Civicदृष्टि', body: 'You have an update.', url: '/dashboard' };
  try { if (event.data) data = { ...data, ...event.data.json() }; } catch { /* non-JSON payload, use defaults */ }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.svg',
      badge: '/icons/icon-192.svg',
      data: { url: data.url || '/dashboard' },
      tag: data.url || 'civicdrishti-update',
    })
  );
});


self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.postMessage({ type: 'push-notification-clicked', url: targetUrl });
          client.navigate ? client.navigate(targetUrl).then(() => client.focus()) : client.focus();
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});