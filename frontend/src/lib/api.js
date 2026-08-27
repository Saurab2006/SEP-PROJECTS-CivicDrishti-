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

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || '';

export async function api(path, init = {}) {
  const token = getToken();
  const headers = { ...init.headers };
  if (!(init.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const url = (API_BASE && path.startsWith('/api')) ? `${API_BASE.replace(/\/$/, '')}${path}` : path;
  const res = await fetch(url, { ...init, headers, cache: init.cache || 'no-store' });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

export const get = (path) => api(path);
export const post = (path, body) => api(path, { method: 'POST', body: JSON.stringify(body) });
export const patch = (path, body) => api(path, { method: 'PATCH', body: JSON.stringify(body) });

export const del = (path) => api(path, { method: 'DELETE' });