'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  BellOff,
  CheckCheck,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  UserCheck,
  Clock,
  PartyPopper,
  Copy,
  ShieldAlert,
  Megaphone,
  RotateCcw,
  ChevronRight,
  X,
  MapPin,
  ArrowUpRight,
  ArrowRight,
  Gift,
} from 'lucide-react';
import { get, patch } from '@/lib/api';
import { relativeTime, cn } from '@/lib/format';

function typeLabel(type) {
  if (!type) return 'Notification';
  return type.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function fullDateTime(input) {
  if (!input) return '—';
  const date = typeof input === 'string' ? new Date(input) : input;
  return date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

function getNotificationVisual(type) {
  switch (type) {
    case 'flagged-fake':
    case 'rejected':
      return {
        bg: 'bg-red-50 text-red-500 ring-1 ring-red-100 dark:bg-red-950/40 dark:text-red-400 dark:ring-red-900/30',
        Icon: AlertOctagon,
      };
    case 'completed':
    case 'verified':
    case 'resolved':
      return {
        bg: 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-900/30',
        Icon: CheckCircle2,
      };
    case 'assigned':
      return {
        bg: 'bg-purple-50 text-purple-600 ring-1 ring-purple-100 dark:bg-purple-950/40 dark:text-purple-400 dark:ring-purple-900/30',
        Icon: UserCheck,
      };
    case 'wishes':
    case 'celebration':
      return {
        bg: 'bg-blue-50 text-blue-600 ring-1 ring-blue-100 dark:bg-blue-950/40 dark:text-blue-400 dark:ring-blue-900/30',
        Icon: Gift,
      };
    case 'new-report':
    case 'important-notice':
    default:
      return {
        bg: 'bg-blue-50 text-blue-600 ring-1 ring-blue-100 dark:bg-blue-950/40 dark:text-blue-400 dark:ring-blue-900/30',
        Icon: Bell,
      };
  }
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
  const { Icon } = getNotificationVisual(notification.type);
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
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">{typeLabel(notification.type)}</p>
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
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
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
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'unread' | 'updates'
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [activeNotification, setActiveNotification] = useState(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const ref = useRef(null);

  const load = useCallback(() => {
    get('/api/notifications')
      .then(d => {
        setItems(d.notifications || []);
        setUnread(d.unreadCount || 0);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const openItem = async (n) => {
    if (!n.read) {
      setItems(prev => prev.map(x => (x._id === n._id ? { ...x, read: true } : x)));
      setUnread(u => Math.max(0, u - 1));
      patch(`/api/notifications/${n._id}`).catch(() => {});
    }
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

  const filteredItems = items.filter(n => {
    if (activeTab === 'unread') return !n.read;
    if (activeTab === 'updates') {
      return ['important-notice', 'eta-updated', 'completed', 'verified'].includes(n.type);
    }
    return true;
  });

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          setOpen(o => !o);
          setActiveTab('all');
        }}
        className={cn(
          'relative grid h-10 w-10 place-items-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100/80 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-gray-200',
          open && 'bg-gray-100 text-gray-900 dark:bg-white/10 dark:text-white'
        )}
        title="Notifications"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white dark:ring-[#111827]">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Backdrop on small screens */}
          <div className="fixed inset-0 z-40 bg-black/20 sm:hidden" onClick={() => setOpen(false)} aria-hidden="true" />

          <div
            role="dialog"
            aria-label="Notifications"
            className="fixed inset-x-3 top-16 z-50 flex max-h-[calc(100vh-80px)] flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl ring-1 ring-black/5 dark:border-gray-800 dark:bg-[#111827] dark:ring-white/10 sm:absolute sm:inset-auto sm:right-[-52px] sm:top-full sm:mt-2.5 sm:w-[410px] sm:max-h-[560px]"
          >
            {/* Pointer arrow aligned with bell icon */}
            <div className="hidden sm:block absolute -top-1.5 right-[66px] h-3 w-3 rotate-45 border-l border-t border-gray-100 bg-white dark:border-gray-800 dark:bg-[#111827]" />

            {/* Top Header */}
            <div className="relative z-10 flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 px-5 pt-4 pb-3 dark:border-gray-800">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Notifications</h3>
              <div className="flex items-center gap-2">
                {unread > 0 && (
                  <button
                    onClick={markAllRead}
                    className="flex items-center gap-1 text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    <CheckCheck className="h-4 w-4" />
                    <span>Mark all as read</span>
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="grid h-7 w-7 place-items-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 sm:hidden dark:hover:bg-white/10"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex shrink-0 items-center gap-6 border-b border-gray-100 px-5 text-xs font-semibold text-gray-500 dark:border-gray-800 dark:text-gray-400">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={cn(
                  'relative py-2.5 transition-colors',
                  activeTab === 'all'
                    ? 'font-bold text-blue-600 dark:text-blue-400'
                    : 'hover:text-gray-800 dark:hover:text-gray-200'
                )}
              >
                All <span className="ml-1 opacity-75">({items.length})</span>
                {activeTab === 'all' && (
                  <span className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('unread')}
                className={cn(
                  'relative py-2.5 transition-colors',
                  activeTab === 'unread'
                    ? 'font-bold text-blue-600 dark:text-blue-400'
                    : 'hover:text-gray-800 dark:hover:text-gray-200'
                )}
              >
                Unread <span className="ml-1 opacity-75">({unread})</span>
                {activeTab === 'unread' && (
                  <span className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('updates')}
                className={cn(
                  'relative py-2.5 transition-colors',
                  activeTab === 'updates'
                    ? 'font-bold text-blue-600 dark:text-blue-400'
                    : 'hover:text-gray-800 dark:hover:text-gray-200'
                )}
              >
                Updates
                {activeTab === 'updates' && (
                  <span className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
                )}
              </button>
            </div>

            {/* Notification Items List */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {filteredItems.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-gray-50 text-gray-300 dark:bg-white/5 dark:text-gray-600">
                    <BellOff className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-medium text-gray-400">
                    {activeTab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                  </p>
                </div>
              ) : (
                filteredItems.map(n => {
                  const { bg, Icon } = getNotificationVisual(n.type);
                  return (
                    <button
                      key={n._id}
                      onClick={() => openItem(n)}
                      className={cn(
                        'group flex w-full items-start gap-3.5 border-b border-gray-50/80 px-5 py-3.5 text-left transition-colors last:border-b-0 hover:bg-gray-50/80 dark:border-gray-800/60 dark:hover:bg-white/5',
                        !n.read && 'bg-blue-50/30 dark:bg-blue-950/15'
                      )}
                    >
                      {/* Left Circular Icon Badge */}
                      <div
                        className={cn(
                          'mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full transition-transform group-hover:scale-105',
                          bg
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate text-[13px] font-bold text-gray-900 dark:text-white">
                            {n.title}
                          </p>
                          <span className="shrink-0 text-[11px] font-normal text-gray-400">
                            {relativeTime(n.createdAt)}
                          </span>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                          {n.message}
                        </p>
                      </div>

                      {/* Unread Indicator Dot */}
                      {!n.read && (
                        <div className="mt-2 flex shrink-0 items-center justify-center">
                          <span className="h-2 w-2 rounded-full bg-blue-600" />
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Bottom Footer */}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                router.push('/dashboard');
              }}
              className="flex h-12 shrink-0 items-center justify-center gap-2 border-t border-gray-100 text-xs font-bold text-blue-600 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:text-blue-400 dark:hover:bg-white/5"
            >
              <Bell className="h-3.5 w-3.5" />
              <span>View all notifications</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
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