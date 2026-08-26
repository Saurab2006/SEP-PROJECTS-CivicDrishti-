'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck, AlertTriangle, UserCheck, Clock, PartyPopper, Copy, ShieldAlert, Megaphone, RotateCcw, ChevronRight, X, MapPin, ArrowUpRight } from 'lucide-react';
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

function typeLabel(type) {
  if (!type) return 'Notification';
  return type.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function fullDateTime(input) {
  if (!input) return '—';
  const date = typeof input === 'string' ? new Date(input) : input;
  return date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

function NotificationDrawer({ notification, visible, onClose, onNavigate }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!notification) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, [notification]);

  if (!notification) return null;
  const Icon = ICONS[notification.type] || Bell;
  const location = [notification.ward, notification.municipality, notification.district, notification.province].filter(Boolean).join(', ');

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        className={cn(
          'fixed inset-0 z-[60] bg-black/40 backdrop-blur-[1px] transition-opacity duration-300 ease-out',
          visible ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Notification details"
        className={cn(
          'fixed inset-y-0 right-0 z-[70] flex h-[100dvh] w-full max-w-[420px] flex-col bg-white shadow-2xl transition-transform duration-300 ease-out dark:bg-[#111827]',
          'sm:rounded-l-2xl',
          visible ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--gov-border)] px-5 py-4 sm:rounded-tl-2xl">
          <div className="flex min-w-0 items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-600">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-600">{typeLabel(notification.type)}</p>
              <h2 className="mt-0.5 text-base font-semibold leading-snug text-gray-900 dark:text-white">{notification.title}</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <p className="text-xs font-medium text-gray-400">{fullDateTime(notification.createdAt)} · {relativeTime(notification.createdAt)}</p>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-gray-700 dark:text-gray-200">{notification.message}</p>

          {(location || notification.priority) && (
            <div className="mt-5 space-y-2 rounded-xl bg-gray-50 p-4 text-sm dark:bg-white/5">
              {location && (
                <div className="flex items-start gap-2 text-gray-600 dark:text-gray-300">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                  <span>{location}</span>
                </div>
              )}
              {notification.priority && (
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-gray-200 dark:bg-white/10 dark:ring-white/10">{notification.priority} priority</span>
                </div>
              )}
            </div>
          )}
        </div>

        {notification.link && (
          <div className="border-t border-[var(--gov-border)] px-5 py-4 sm:rounded-bl-2xl">
            <button
              type="button"
              onClick={() => onNavigate(notification.link)}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
            >
              View details
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </aside>
    </>
  );
}

export default function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [activeNotification, setActiveNotification] = useState(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
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
    setActiveNotification(n);
    requestAnimationFrame(() => requestAnimationFrame(() => setDrawerVisible(true)));
  };

  const closeDrawer = useCallback(() => {
    setDrawerVisible(false);
    setTimeout(() => setActiveNotification(null), 300);
  }, []);

  const navigateFromDrawer = (link) => {
    closeDrawer();
    router.push(link);
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

      <NotificationDrawer
        notification={activeNotification}
        visible={drawerVisible}
        onClose={closeDrawer}
        onNavigate={navigateFromDrawer}
      />
    </div>
  );
}