'use client';
import { useEffect, useRef, useState, useCallback, useLayoutEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, BellOff, CheckCheck, AlertTriangle, UserCheck, Clock, PartyPopper, Copy, ShieldAlert, Megaphone, RotateCcw, ChevronRight, X, MapPin, ArrowUpRight } from 'lucide-react';
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

const PANEL_MARGIN = 12; // min gap kept between the panel and the viewport edges
const PANEL_MAX_WIDTH = 380;

export default function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [activeNotification, setActiveNotification] = useState(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [coords, setCoords] = useState(null);
  const ref = useRef(null);
  const panelRef = useRef(null);

  const load = useCallback(() => {
    get('/api/notifications').then(d => { setItems(d.notifications || []); setUnread(d.unreadCount || 0); }).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target) && panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Position the panel against the viewport (not the trigger's offset parent) so it
  // always stays fully on-screen — regardless of where the bell sits in the header.
  const reposition = useCallback(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const isMobile = vw < 1024; // matches the lg: breakpoint used by MobileTabBar/Topbar
    const bottomReserve = isMobile ? 84 : PANEL_MARGIN; // clears the fixed mobile tab bar

    const width = Math.min(PANEL_MAX_WIDTH, vw - PANEL_MARGIN * 2);
    let left = rect.right - width; // prefer aligning the panel's right edge to the bell
    left = Math.max(PANEL_MARGIN, Math.min(left, vw - width - PANEL_MARGIN));

    let top = rect.bottom + 8;
    const maxHeight = Math.max(220, vh - top - bottomReserve);

    setCoords({ top, left, width, maxHeight });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open, reposition]);

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
      <button
        onClick={() => { setOpen(o => !o); setShowAll(false); }}
        className={cn('relative grid h-10 w-10 place-items-center rounded-lg text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-700', open && 'bg-gray-50 text-gray-700')}
        title="Notifications"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Dims the page on small screens so the panel reads as a focused overlay rather than a stray box */}
          <div className="fixed inset-0 z-40 bg-black/10 lg:hidden" aria-hidden="true" />

          <div
            ref={panelRef}
            role="dialog"
            aria-label="Notifications"
            style={coords ? { top: coords.top, left: coords.left, width: coords.width, maxHeight: coords.maxHeight } : { visibility: 'hidden' }}
            className="fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl ring-1 ring-black/5"
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 px-4 py-3.5">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
                <p className="mt-0.5 truncate text-xs text-gray-400">{unread ? `${unread} unread` : 'You are up to date'}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {unread > 0 && (
                  <button onClick={markAllRead} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-600 transition-colors hover:bg-brand-50">
                    Mark all read
                  </button>
                )}
                <button onClick={() => setOpen(false)} aria-label="Close notifications" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 lg:hidden">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {recentItems.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-gray-50 text-gray-300">
                    <BellOff className="h-5 w-5" />
                  </div>
                  <p className="text-sm text-gray-400">You&apos;re all caught up</p>
                </div>
              ) : recentItems.map(n => {
                const Icon = ICONS[n.type] || Bell;
                return (
                  <button key={n._id} onClick={() => openItem(n)} className={cn('flex w-full items-start gap-3 border-b border-gray-50 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-gray-50/70', !n.read && 'bg-brand-50/40')}>
                    <div className={cn('mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full', !n.read ? 'bg-brand-100 text-brand-600' : 'bg-gray-100 text-gray-400')}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn('text-[13px] leading-snug', !n.read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700')}>{n.title}</p>
                        {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-gray-500">{n.message}</p>
                      <p className="mt-1 text-[11px] text-gray-400">{relativeTime(n.createdAt)}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {items.length > 5 && (
              <button
                type="button"
                onClick={() => setShowAll(v => !v)}
                className="flex h-12 shrink-0 items-center justify-center gap-1.5 border-t border-gray-100 text-sm font-semibold text-brand-600 transition-colors hover:bg-gray-50"
              >
                {showAll ? 'Show recent only' : 'View all notifications'}
                <ChevronRight className={cn('h-4 w-4 transition-transform', showAll && 'rotate-90')} />
              </button>
            )}
          </div>
        </>
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