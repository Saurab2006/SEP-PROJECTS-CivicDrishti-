'use client';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { getToken } from '@/lib/api';
import { flushQueue } from '@/lib/offlineQueue';

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Service worker registration failed:', err);
    });

    const onMessage = (event) => {
      if (event.data?.type === 'queued-report-synced') {
        toast.success('A report saved while you were offline has been submitted.');
      }
      if (event.data?.type === 'sw-updated') {
        if (!sessionStorage.getItem('sw-reloaded')) {
          sessionStorage.setItem('sw-reloaded', '1');
          window.location.reload();
        }
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);

    const onOnline = async () => {
      // 1. Tell SW to flush its own IndexedDB queue.
      navigator.serviceWorker.controller?.postMessage({ type: 'flush-queue' });

      // 2. Also flush the client-side IndexedDB queue (catches cases where SW
      //    wasn't active at submission time, e.g. first install or private browsing).
      try {
        const token = getToken();
        const flushed = await flushQueue(token);
        if (flushed > 0) {
          toast.success(
            flushed === 1
              ? '✅ Your offline report has been submitted!'
              : `✅ ${flushed} offline reports have been submitted!`,
            { duration: 5000 }
          );
        }
      } catch { /* silently ignore flush errors */ }
    };

    window.addEventListener('online', onOnline);

    return () => {
      navigator.serviceWorker.removeEventListener('message', onMessage);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  return null;
}