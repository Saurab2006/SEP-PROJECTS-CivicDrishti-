// Civicदृष्टि — offline service worker v4
// Bumped to v4 to force all clients to install the updated SW.
const CACHE_VERSION = 'govinsight-v4';
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`;
const API_CACHE = `${CACHE_VERSION}-api`;
const QUEUE_DB = 'govinsight-offline-queue';
const QUEUE_STORE = 'pending-requests';

// The backend's absolute origin — API requests that bypass the Next.js proxy
// and hit this domain directly are also intercepted and cached.
const BACKEND_ORIGIN = 'https://sep-projects-civic-drishti-backend.vercel.app';

const APP_SHELL_URLS = [
  '/',
  '/dashboard',
  '/issues',
  '/reports',
  '/analytics',
  '/budget',
  '/authorities',
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
    caches.open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(CACHE_VERSION)).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then((clients) => clients.forEach((client) => client.postMessage({ type: 'sw-updated' })))
  );
});

// ---- Helper: is this an API request we care about? ----
function classifyRequest(request) {
  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isBackendOrigin = url.origin === BACKEND_ORIGIN;
  const isApi = url.pathname.startsWith('/api/');

  // Identity/auth always goes to network (never serve stale roles).
  const isIdentity = isApi && url.pathname.startsWith('/api/auth/me');
  // Report mutations we queue when offline.
  const isReportWrite = isApi && url.pathname.startsWith('/api/reports') && request.method !== 'GET';

  return { isSameOrigin, isBackendOrigin, isApi, isIdentity, isReportWrite };
}

// ---- fetch handling ----
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const { isSameOrigin, isBackendOrigin, isApi, isIdentity, isReportWrite } = classifyRequest(request);

  // Only handle same-origin OR known backend-origin requests.
  if (!isSameOrigin && !isBackendOrigin) return;

  // Never intercept identity requests — always hit network.
  if (isIdentity) return;

  // --- Page navigation: network first, fall back to cached shell ---
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          caches.open(APP_SHELL_CACHE).then((cache) => cache.put(request, response.clone()));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
    );
    return;
  }

  // --- Report mutations: try network, queue on offline ---
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
          JSON.stringify({ queued: true, offline: true, message: "Saved offline — will submit automatically once you're back online." }),
          { status: 202, headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // --- API GET: network first, fall back to cache ---
  if (isApi && request.method === 'GET') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            caches.open(API_CACHE).then((cache) => cache.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // --- Next.js build assets: network first, cache fallback ---
  if (new URL(request.url).pathname.startsWith('/_next/') && request.method === 'GET') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          caches.open(APP_SHELL_CACHE).then((cache) => cache.put(request, response.clone()));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // --- Static assets: cache first ---
  if (request.method === 'GET') {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request)
          .then((response) => {
            caches.open(APP_SHELL_CACHE).then((cache) => cache.put(request, response.clone()));
            return response;
          })
          .catch(() => caches.match('/dashboard'));
      })
    );
  }
});

// ---- Background sync: replay queued report submissions ----
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-queued-reports') {
    event.waitUntil(replayQueuedRequests());
  }
});

// Fallback for browsers without Background Sync (e.g. iOS Safari).
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
        clients.forEach((client) =>
          client.postMessage({ type: 'queued-report-synced', id: entry.id })
        );
      }
    } catch {
      // Still offline — leave it queued.
      break;
    }
  }
}

// ---- Push notifications ----
self.addEventListener('push', (event) => {
  let data = { title: 'Civicदृष्टि', body: 'You have an update.', url: '/dashboard' };
  try { if (event.data) data = { ...data, ...event.data.json() }; } catch { /* non-JSON payload */ }

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