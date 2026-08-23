'use client';
import { useEffect, useState } from 'react';

export function useOnlineStatus() {
  // Default to true so SSR/first paint doesn't flash an incorrect banner;
  // corrected immediately on mount from navigator.onLine.
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}
