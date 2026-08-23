'use client';
import { useEffect, useState } from 'react';
import { get } from '@/lib/api';
import { AlertTriangle } from 'lucide-react';

export default function ImportantNoticeBanner() {
  const [notice, setNotice] = useState(null);
  useEffect(() => { get('/api/notices/active').then(d => setNotice(d.notice || null)).catch(() => {}); }, []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), notice.priority === 'urgent' ? 8000 : 5500);
    return () => clearTimeout(t);
  }, [notice]);
  if (!notice) return null;
  const urgent = notice.priority === 'urgent';
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/20 px-4 backdrop-blur-[1px]" onClick={() => setNotice(null)}>
      <div onClick={e => e.stopPropagation()} className={urgent ? 'w-full max-w-lg rounded-lg border border-red-200 bg-red-50 p-6 text-red-900 shadow-2xl' : 'w-full max-w-lg rounded-lg border border-[#eadfce] bg-[#fff7e8] p-6 text-[#102a2b] shadow-2xl'}>
        <div className="flex gap-3"><AlertTriangle className={urgent ? 'mt-0.5 h-5 w-5 shrink-0 text-red-600' : 'mt-0.5 h-5 w-5 shrink-0 text-[#dc143c]'} /><div><p className="text-base font-black">{notice.title}</p><p className="mt-2 text-sm leading-6 opacity-85">{notice.message}</p><p className="mt-4 text-[11px] font-bold uppercase tracking-[0.16em] opacity-60">This notice closes automatically</p></div></div>
      </div>
    </div>
  );
}
