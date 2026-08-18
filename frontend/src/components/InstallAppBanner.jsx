'use client';
import { useEffect, useState } from 'react';
import { useInstallPrompt } from '@/lib/useInstallPrompt';
import { useLanguage } from '@/context/LanguageContext';
import { Download, X } from 'lucide-react';

const DISMISS_KEY = 'civic-install-banner-dismissed';

// Renders nothing until the browser actually fires beforeinstallprompt
// (Chrome/Edge/Android only), so this never nags on unsupported browsers.
// A dismiss is remembered for 14 days, in line with MDN's guidance to keep
// install/notification prompts from becoming annoying.
export default function InstallAppBanner() {
  const { canInstall, installed, promptInstall } = useInstallPrompt();
  const { t } = useLanguage();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      const until = Number(localStorage.getItem(DISMISS_KEY) || 0);
      setDismissed(until > Date.now());
    } catch { setDismissed(false); }
  }, []);

  if (installed || dismissed || !canInstall) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now() + 14 * 24 * 60 * 60 * 1000)); } catch { /* noop */ }
    setDismissed(true);
  };

  const install = async () => {
    const accepted = await promptInstall();
    if (accepted) setDismissed(true);
  };

  return (
    <div className="fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-md items-center gap-3 rounded-lg border border-[#ded6c8] bg-white p-3 shadow-lg sm:inset-x-auto sm:right-4">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#eef6f4] text-[#0f3d3e]"><Download className="h-4 w-4" /></div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-black text-[#102a2b]">{t('settings.installApp')}</p>
        <p className="truncate text-[11px] text-[#8c8272]">{t('settings.installAppSub')}</p>
      </div>
      <button onClick={install} className="shrink-0 rounded-lg bg-[#0f3d3e] px-3 py-1.5 text-xs font-black text-white hover:bg-[#102a2b]">{t('settings.installButton')}</button>
      <button onClick={dismiss} aria-label="Dismiss" className="shrink-0 rounded-md p-1 text-[#8c8272] hover:bg-[#f7f2ea]"><X className="h-3.5 w-3.5" /></button>
    </div>
  );
}