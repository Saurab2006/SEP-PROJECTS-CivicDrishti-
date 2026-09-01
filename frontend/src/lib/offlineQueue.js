// ─── Offline Queue (IndexedDB) ───────────────────────────────────────────────
// Stores pending report/mutation requests made while offline so they can be
// replayed automatically once the device comes back online.

const DB_NAME = 'civicdrishti-offline-queue';
const DB_VERSION = 1;
const STORE = 'pending';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueueRequest(entry) {
  if (typeof window === 'undefined') return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).add({ ...entry, queuedAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getQueuedRequests() {
  if (typeof window === 'undefined') return [];
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteQueuedRequest(id) {
  if (typeof window === 'undefined') return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Returns the number of successfully replayed requests.
export async function flushQueue(token) {
  const queued = await getQueuedRequests();
  let flushed = 0;
  for (const entry of queued) {
    try {
      const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
      const res = await fetch(entry.url, { method: entry.method, headers, body: entry.body });
      if (res.ok) {
        await deleteQueuedRequest(entry.id);
        flushed++;
      }
    } catch {
      // Still offline — stop and retry on next flush.
      break;
    }
  }
  return flushed;
}

export async function getPendingCount() {
  const items = await getQueuedRequests().catch(() => []);
  return items.length;
}
