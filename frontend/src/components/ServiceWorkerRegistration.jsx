'use client';
import { useEffect } from 'react';
import { toast } from 'sonner';

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
    };
    navigator.serviceWorker.addEventListener('message', onMessage);

    // Background Sync isn't supported everywhere (notably iOS Safari), so
    // also flush the offline queue manually the moment the browser tells us
    // we're back online.
    const onOnline = () => {
      navigator.serviceWorker.controller?.postMessage({ type: 'flush-queue' });
    };
    window.addEventListener('online', onOnline);

    return () => {
      navigator.serviceWorker.removeEventListener('message', onMessage);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  return null;
}
