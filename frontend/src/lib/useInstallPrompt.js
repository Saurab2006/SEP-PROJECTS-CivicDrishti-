'use client';
import { useCallback, useEffect, useState } from 'react';

// Wraps the browser's native install flow. Chrome/Edge/Android fire
// "beforeinstallprompt" when the site qualifies as installable (valid
// manifest + registered service worker); Safari/iOS never fires it, so
// canInstall simply stays false there and callers should fall back to
// "Add to Home Screen" instructions if they want to support it too.
export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setInstalled(window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true);

    const onBeforeInstall = (e) => { e.preventDefault(); setDeferredPrompt(e); };
    const onInstalled = () => { setInstalled(true); setDeferredPrompt(null); };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false;
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      return outcome === 'accepted';
    } catch {
      setDeferredPrompt(null);
      return false;
    }
  }, [deferredPrompt]);

  return { canInstall: Boolean(deferredPrompt), installed, promptInstall };
}