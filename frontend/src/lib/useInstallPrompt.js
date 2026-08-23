'use client';
import { useCallback, useEffect, useState } from 'react';

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isSafari, setIsSafari] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setInstalled(window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true);

    const ua = window.navigator.userAgent || '';
    // iPadOS 13+ reports as "Macintosh" but exposes touch points, so check for that too.
    const iOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
    const safari = /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(ua);
    setIsIOS(iOS);
    setIsSafari(safari);

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

  const isIOSSafari = isIOS && isSafari;

  return {
    canInstall: Boolean(deferredPrompt),
    installed,
    promptInstall,
    isIOS,
    isIOSSafari,
  };
}