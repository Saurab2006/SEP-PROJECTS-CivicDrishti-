const TOKEN_KEY = 'gi_token';

export function getToken() {
  if (typeof window === 'undefined') return null;
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function saveToken(token) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(TOKEN_KEY, token); } catch {}
}

export function clearToken() {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(TOKEN_KEY); } catch {}
}

// ─── Offline-aware cache ─────────────────────────────────────────────────────
// GET responses are stored in localStorage with a 30-minute TTL so they are
// available when the device goes offline before the service worker has a chance
// to cache them.

const CACHE_PREFIX = 'api_cache:';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function cacheKey(path) {
  return `${CACHE_PREFIX}${path}`;
}

function readCache(path) {
  try {
    const raw = localStorage.getItem(cacheKey(path));
    if (!raw) return null;
    const { data, expiresAt } = JSON.parse(raw);
    if (Date.now() > expiresAt) { localStorage.removeItem(cacheKey(path)); return null; }
    return data;
  } catch { return null; }
}

function writeCache(path, data) {
  try {
    localStorage.setItem(cacheKey(path), JSON.stringify({ data, expiresAt: Date.now() + CACHE_TTL_MS }));
  } catch { /* localStorage full — silently skip */ }
}

// ─── Offline queue ────────────────────────────────────────────────────────────
// Non-GET requests (report submissions) that fail while offline are saved to
// IndexedDB and replayed by useOfflineSync when the device comes back online.

async function queueOfflineRequest(url, method, body, headers) {
  const { enqueueRequest } = await import('@/lib/offlineQueue');
  await enqueueRequest({ url, method, body: typeof body === 'string' ? body : JSON.stringify(body), headers });
}

// ─── Core API helper ──────────────────────────────────────────────────────────

// Always use relative /api/... paths so Next.js rewrites proxy them to the
// backend on the same origin — this lets the service worker intercept and cache
// them for offline use.
const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || '';

export async function api(path, init = {}) {
  const token = getToken();
  const isFormData = init.body instanceof FormData;
  const headers = { ...init.headers };
  if (!isFormData) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  // Always resolve to a relative URL so the service worker can intercept it.
  // Only fall back to an absolute URL if explicitly overridden via env (dev proxy).
  const url = (API_BASE && path.startsWith('/api'))
    ? `${API_BASE.replace(/\/$/, '')}${path}`
    : path;

  const isGet = !init.method || init.method.toUpperCase() === 'GET';
  const isMutation = !isGet;

  try {
    const res = await fetch(url, { ...init, headers });
    const data = await res.json().catch(() => null);

    // Offline-queued response from service worker.
    if (res.status === 202 && data?.queued) return data;

    if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);

    // Cache successful GET responses for offline fallback.
    if (isGet) writeCache(path, data);

    return data;
  } catch (err) {
    const isOffline = !navigator.onLine || err.name === 'TypeError';

    // Serve from local cache when offline (GET).
    if (isGet && isOffline) {
      const cached = readCache(path);
      if (cached !== null) return cached;
    }

    // Queue mutations (POST/PATCH/DELETE) when offline.
    if (isMutation && isOffline) {
      const bodyStr = isFormData ? null : (init.body ?? null);
      if (bodyStr !== null) {
        await queueOfflineRequest(url, init.method || 'POST', bodyStr, headers).catch(() => {});
        return { queued: true, offline: true, message: "Saved offline — will submit automatically once you're back online." };
      }
    }

    throw err;
  }
}

export const get  = (path)       => api(path);
export const post = (path, body) => api(path, { method: 'POST',   body: JSON.stringify(body) });
export const patch = (path, body) => api(path, { method: 'PATCH',  body: JSON.stringify(body) });
export const del  = (path)       => api(path, { method: 'DELETE' });