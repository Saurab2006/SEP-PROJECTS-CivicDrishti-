'use client';
import { useEffect, useCallback, useState } from 'react';
import { toast } from 'sonner';
import { flushQueue, getPendingCount } from '@/lib/offlineQueue';
import { getToken } from '@/lib/api';

/**
 * useOfflineSync
 *
 * Listens for the browser coming back online and automatically replays any
 * report submissions that were queued while offline. Also exposes
 * `pendingCount` so the UI can show a badge on the offline banner.
 */
export function useOfflineSync() {
  const [pendingCount, setPendingCount] = useState(0);

  // Refresh pending count on mount and when called manually.
  const refreshCount = useCallback(async () => {
    const count = await getPendingCount().catch(() => 0);
    setPendingCount(count);
  }, []);

  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  useEffect(() => {
    const sync = async () => {
      const token = getToken();
      const flushed = await flushQueue(token).catch(() => 0);
      if (flushed > 0) {
        toast.success(
          flushed === 1
            ? '✅ Your offline report has been submitted!'
            : `✅ ${flushed} offline reports have been submitted!`,
          { duration: 5000 }
        );
        // Also tell the service worker to flush its own queue.
        navigator.serviceWorker?.controller?.postMessage({ type: 'flush-queue' });
      }
      refreshCount();
    };

    window.addEventListener('online', sync);
    return () => window.removeEventListener('online', sync);
  }, [refreshCount]);

  return { pendingCount, refreshCount };
}
