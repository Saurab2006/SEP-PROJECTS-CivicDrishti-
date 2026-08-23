'use client';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/lib/useOnlineStatus';
import { useTranslation } from '@/context/LanguageContext';

export default function OfflineBanner() {
  const online = useOnlineStatus();
  const { t } = useTranslation();
  if (online) return null;

  return (
    <div className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-amber-500 text-white text-xs font-semibold px-4 py-1.5">
      <WifiOff className="w-3.5 h-3.5" />
      {t('offline.banner')}
    </div>
  );
}
