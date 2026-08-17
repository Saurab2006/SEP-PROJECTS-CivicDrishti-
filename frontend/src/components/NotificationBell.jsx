'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck, AlertTriangle, UserCheck, Clock, PartyPopper, Copy, ShieldAlert, Megaphone, RotateCcw, ChevronRight } from 'lucide-react';
import { get, patch } from '@/lib/api';
import { relativeTime, cn } from '@/lib/format';

const ICONS = {
  'new-report': AlertTriangle,
  assigned: UserCheck,
  'eta-updated': Clock,
  verified: CheckCheck,
  completed: PartyPopper,
  duplicate: Copy,
  'flagged-fake': ShieldAlert,
  'important-notice': Megaphone,
  reopened: RotateCcw,
};

export default function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);

  const load = useCallback(() => {
    get('/api/notifications').then(d => { setItems(d.notifications || []); setUnread(d.unreadCount || 0); }).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const openItem = async (n) => {
    if (!n.read) { setItems(prev => prev.map(x => x._id === n._id ? { ...x, read: true } : x)); setUnread(u => Math.max(0, u - 1)); patch(`/api/notifications/${n._id}`).catch(() => {}); }
    setOpen(false);
    if (n.link) router.push(n.link);
  };

  const markAllRead = async () => {
    setItems(prev => prev.map(x => ({ ...x, read: true })));
    setUnread(0);
    try { await patch('/api/notifications'); } catch {}
  };

  const recentItems = items.slice(0, showAll ? 25 : 5);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => { setOpen(o => !o); setShowAll(false); }} className="relative p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors" title="Notifications">
        <Bell className="w-4 h-4" />
        {unread > 0 && <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 flex max-h-[min(440px,calc(100vh-88px))] w-[min(360px,calc(100vw-24px))] flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-xl z-40">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <div><h3 className="text-sm font-semibold text-gray-900">Notifications</h3><p className="mt-0.5 text-[11px] text-gray-400">{unread ? `${unread} unread` : 'You are up to date'}</p></div>
            {unread > 0 && <button onClick={markAllRead} className="text-xs font-medium text-brand-600 hover:text-brand-700">Mark read</button>}
          </div>
          <div className="overflow-y-auto flex-1">
            {recentItems.length === 0 ? (
              <div className="px-4 py-9 text-center text-sm text-gray-400">You're all caught up</div>
            ) : recentItems.map(n => {
              const Icon = ICONS[n.type] || Bell;
              return (
                <button key={n._id} onClick={() => openItem(n)} className={cn('w-full text-left px-4 py-3 flex gap-3 border-b border-gray-50 hover:bg-gray-50/70 transition-colors', !n.read && 'bg-brand-50/40')}>
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5', !n.read ? 'bg-brand-100 text-brand-600' : 'bg-gray-100 text-gray-400')}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className={cn('text-[13px] leading-snug', !n.read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700')}>{n.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{relativeTime(n.createdAt)}</p>
                  </div>
                  {!n.read && <span className="w-2 h-2 rounded-full bg-brand-500 shrink-0 mt-1.5" />}
                </button>
              );
            })}
          </div>
          {items.length > 5 && <button type="button" onClick={() => setShowAll(v => !v)} className="flex h-11 items-center justify-center gap-1.5 border-t border-gray-100 text-xs font-semibold text-brand-600 hover:bg-gray-50">{showAll ? 'Show recent only' : 'View all notifications'} <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', showAll && 'rotate-90')} /></button>}
        </div>
      )}
    </div>
  );
}
