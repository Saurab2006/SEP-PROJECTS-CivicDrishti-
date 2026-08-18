'use client';
import { api, get } from '@/lib/api';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function isPushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

async function getServiceWorkerRegistration() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  const existing = await navigator.serviceWorker.getRegistration('/');
  if (existing) return existing;

  const registered = await navigator.serviceWorker.register('/sw.js').catch(() => null);
  if (registered) return registered;

  return Promise.race([
    navigator.serviceWorker.ready.catch(() => null),
    new Promise(resolve => setTimeout(() => resolve(null), 2500)),
  ]);
}

// Reads current support/permission/subscription state without prompting for
// anything - safe to call on every Settings page load.
export async function getPushSubscriptionState() {
  if (!isPushSupported()) return { supported: false, subscribed: false, permission: 'unsupported' };
  const registration = await getServiceWorkerRegistration();
  const subscription = registration ? await registration.pushManager.getSubscription() : null;
  return { supported: true, subscribed: Boolean(subscription), permission: Notification.permission };
}

// Opt-in flow: request permission, subscribe via the service worker's push
// manager, then hand the subscription to the backend so report-status
// updates can be delivered to this device. Throws a friendly Error the
// caller can toast on failure at any step.
export async function subscribeToPush() {
  if (!isPushSupported()) throw new Error("Push notifications aren't supported on this browser.");
  const registration = await getServiceWorkerRegistration();
  if (!registration) throw new Error('App notifications could not start. Reload the page once, then try Enable again.');

  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications are blocked in your browser settings.');

  const { publicKey, configured } = await get('/api/notifications/push/public-key');
  if (!configured || !publicKey) throw new Error("Push notifications aren't configured on the server yet.");

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  const json = subscription.toJSON();
  await api('/api/notifications/push/subscribe', {
    method: 'POST',
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys, userAgent: navigator.userAgent }),
  });
  return subscription;
}

// Opt-out flow: unsubscribes the browser and removes the matching
// subscription server-side so no more pushes are sent to this device.
export async function unsubscribeFromPush() {
  const registration = await getServiceWorkerRegistration();
  const subscription = registration ? await registration.pushManager.getSubscription() : null;
  const endpoint = subscription?.endpoint;
  if (subscription) await subscription.unsubscribe().catch(() => null);
  if (endpoint) await api('/api/notifications/push/subscribe', { method: 'DELETE', body: JSON.stringify({ endpoint }) }).catch(() => null);
}