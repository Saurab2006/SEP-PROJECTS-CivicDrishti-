'use client';
import { useEffect, useState } from 'react';
import { useInstallPrompt } from '@/lib/useInstallPrompt';
import { useLanguage } from '@/context/LanguageContext';
import { Download, Share, X } from 'lucide-react';

const DISMISS_KEY = 'civic-install-banner-dismissed';

export default function InstallAppBanner() {
  const { canInstall, installed, promptInstall, isIOSSafari } = useInstallPrompt();
  const { t } = useLanguage();
  const [dismissed, setDismissed] = useState(true);
  const [showIOSTip, setShowIOSTip] = useState(false);

  useEffect(() => {
    try {
      const until = Number(localStorage.getItem(DISMISS_KEY) || 0);
      setDismissed(until > Date.now());
    } catch { setDismissed(false); }
  }, []);

  if (installed || dismissed || (!canInstall && !isIOSSafari)) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now() + 14 * 24 * 60 * 60 * 1000)); } catch { /* noop */ }
    setDismissed(true);
  };

  const install = async () => {
    if (isIOSSafari) { setShowIOSTip((v) => !v); return; }
    const accepted = await promptInstall();
    if (accepted) setDismissed(true);
  };

  return (
    <div className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-md rounded-lg border border-[#ded6c8] bg-white p-3 shadow-lg sm:inset-x-auto sm:right-4">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#eef6f4] text-[#0f3d3e]"><Download className="h-4 w-4" /></div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-black text-[#102a2b]">{t('settings.installApp')}</p>
          <p className="truncate text-[11px] text-[#8c8272]">{t('settings.installAppSub')}</p>
        </div>
        <button onClick={install} className="shrink-0 rounded-lg bg-[#0f3d3e] px-3 py-1.5 text-xs font-black text-white hover:bg-[#102a2b]">
          {isIOSSafari ? t('settings.installButtonIOS') : t('settings.installButton')}
        </button>
        <button onClick={dismiss} aria-label="Dismiss" className="shrink-0 rounded-md p-1 text-[#8c8272] hover:bg-[#f7f2ea]"><X className="h-3.5 w-3.5" /></button>
      </div>
      {isIOSSafari && showIOSTip && (
        <div className="mt-2 flex items-start gap-2 rounded-md border border-[#ded6c8] bg-[#fffaf2] px-3 py-2">
          <Share className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0f3d3e]" />
          <p className="text-[11px] text-[#65706c]">{t('settings.installAppIOS')}</p>
        </div>
      )}
    </div>
  );
}