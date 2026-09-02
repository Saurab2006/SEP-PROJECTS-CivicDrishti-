'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, ClipboardList, Gauge, Landmark, LogOut, MapPinned, ScrollText, Settings, Table2, Users, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { cn, initials } from '@/lib/format';
import { CivicLogo } from './CivicBrand';

const GROUPS = [
  {
    key: 'nav.civicWork',
    items: [
      { href: '/dashboard', key: 'nav.dashboard', note: 'nav.overviewNote', icon: Gauge },
      { href: '/issues', key: 'nav.issues', note: 'nav.issuesNote', icon: ClipboardList },
      { href: '/budget', key: 'nav.budget', note: 'nav.budgetNote', icon: Table2 },
    ],
  },
  {
    key: 'nav.accountability',
    items: [
           { href: '/authorities', key: 'nav.authorities', note: 'nav.authoritiesNote', icon: Landmark },
      { href: '/wards', key: 'nav.wards', note: 'nav.wardsNote', icon: MapPinned, hideForRoles: ['ward_rep', 'admin'] },
    ],
  },
];

export default function Sidebar({ collapsed = false, mobileOpen = false, onMobileClose }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const roleKey = user?.role === 'researcher' ? 'role.citizen' : user?.role === 'municipality_head' ? 'role.municipalityHead' : user?.role === 'ward_rep' ? 'role.wardRep' : 'role.admin';
  const accessKey = user?.role === 'admin' ? 'access.full' : user?.role === 'municipality_head' ? 'access.municipalityOnly' : user?.role === 'ward_rep' ? 'access.wardOnly' : 'access.citizen';
  const isActive = (href) => pathname === href || pathname.startsWith(href + '/');

  const navLinkClass = (active) => cn(
    'group flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--gov-primary)]/30',
    collapsed ? 'justify-center px-2' : '',
    active
      ? 'border-[#f5f7fa] bg-white text-[#17212b] shadow-sm dark:border-[#253044] dark:bg-[#1f2937] dark:text-white'
      : 'border-transparent text-[#263442] hover:border-[#aebdcb] hover:bg-white/55 hover:text-[#17212b] dark:text-[#b8c2cf] dark:hover:border-[#253044] dark:hover:bg-white/5 dark:hover:text-white'
  );
  const iconClass = (active) => cn('h-4 w-4 shrink-0', active ? 'text-[var(--gov-primary)]' : 'text-[#4e6174] group-hover:text-[#17212b] dark:text-[#8792a0] dark:group-hover:text-white');

  const item = (href, label, note, Icon) => {
    const active = isActive(href);
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? 'page' : undefined}
        title={collapsed ? label : undefined}
        onClick={onMobileClose}
        className={navLinkClass(active)}
      >
        <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-md', active ? 'bg-[#fff4f3] dark:bg-white/10' : 'bg-white/35 dark:bg-white/5')}>
          <Icon className={iconClass(active)} />
        </span>
        {!collapsed && (
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium leading-5">{label}</span>
          </span>
        )}
      </Link>
    );
  };

  const content = (
    <>
      <div className={cn('flex items-center border-b border-[#aebdcb] px-5 py-5 dark:border-[#253044]', collapsed ? 'justify-center px-3' : 'justify-between')}>
        <CivicLogo compact={collapsed} />
        <button type="button" onClick={onMobileClose} className="grid h-9 w-9 place-items-center rounded-lg text-[#4e6174] hover:bg-white/60 dark:text-[#8792a0] dark:hover:bg-white/10 lg:hidden" aria-label="Close menu">
          <X className="h-4 w-4" />
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {GROUPS.map(group => (
          <section key={group.key} className="mb-6">
            {!collapsed && group.key !== 'nav.civicWork' && <p className="px-3 pb-2 text-xs font-medium uppercase tracking-wide text-[#4e6174] dark:text-[#8792a0]">{t(group.key)}</p>}
            <div className="space-y-1">
              {group.items.filter(i => !i.hideForRoles?.includes(user?.role)).map(i => item(i.href, t(i.key), t(i.note), i.icon))}
              {group.key === 'nav.accountability' && user?.role === 'admin' && item('/admin/audit-logs', t('nav.auditLogs'), t('nav.auditLogsNote'), ScrollText)}
            </div>
          </section>
        ))}
        {user?.role === 'municipality_head' && (
          <section className="mb-6">
            {!collapsed && <p className="px-3 pb-2 text-xs font-medium uppercase tracking-wide text-[#4e6174] dark:text-[#8792a0]">Municipality</p>}
            <div className="space-y-1">{item('/municipality/dashboard', 'Municipality dashboard', 'wards, issues, budget', Building2)}</div>
          </section>
        )}
        {user?.role === 'admin' && (
          <section className="mb-6">
            {!collapsed && <p className="px-3 pb-2 text-xs font-medium uppercase tracking-wide text-[#4e6174] dark:text-[#8792a0]">{t('nav.administration')}</p>}
            <div className="space-y-1">
              {item('/admin/users', t('nav.userManagement'), t('nav.usersNote'), Users)}
              {item('/admin/wards', t('nav.wardsAdmin'), t('nav.wardsAdminNote'), MapPinned)}
              {item('/admin/municipality-heads', 'Municipality heads', 'local government access', Building2)}
            </div>
          </section>
        )}
        <section>
          {!collapsed && <p className="px-3 pb-2 text-xs font-medium uppercase tracking-wide text-[#4e6174] dark:text-[#8792a0]">{t('nav.account')}</p>}
          {item('/settings', t('nav.settings'), t('nav.settingsNote'), Settings)}
        </section>
      </nav>
      {user && (
        <div className="border-t border-[#aebdcb] p-4 dark:border-[#253044]">
          <div className={cn('flex items-center gap-3 rounded-lg bg-white/45 p-3 ring-1 ring-[#aebdcb] dark:bg-white/5 dark:ring-[#253044]', collapsed ? 'justify-center p-2' : '')}>
            <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-[#17212b] text-sm font-semibold text-white" title={user.name}>{user.selfiePhoto ? <img src={user.selfiePhoto} alt="" className="h-full w-full object-cover" /> : initials(user.name)}</div>
            {!collapsed && (
              <>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium leading-5 text-[#17212b] dark:text-white">{user.name}</p>
                  <p className="truncate text-xs font-normal leading-4 text-[#263442] dark:text-[#b8c2cf]">{t(roleKey)}</p>
                </div>
                <button onClick={logout} title={t('topbar.signOut')} className="rounded-md p-2 text-[#4e6174] transition-colors hover:bg-white/55 hover:text-[#17212b] dark:text-[#8792a0] dark:hover:bg-white/10 dark:hover:text-white">
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );

  return (
    <>
      <aside className={cn('fixed inset-y-0 left-0 z-40 hidden h-screen shrink-0 border-r border-[#aebdcb] bg-[#bcc8d5] transition-[width] duration-300 dark:border-[#253044] dark:bg-[#111827] lg:flex lg:flex-col', collapsed ? 'w-[84px]' : 'w-[276px]')}>
        {content}
      </aside>
      {mobileOpen && <button type="button" aria-label="Close menu" onClick={onMobileClose} className="fixed inset-0 z-40 bg-black/35 lg:hidden" />}
      <aside className={cn('fixed inset-y-0 left-0 z-50 flex w-[min(86vw,320px)] flex-col border-r border-[#aebdcb] bg-[#bcc8d5] shadow-2xl transition-transform duration-300 dark:border-[#253044] dark:bg-[#111827] lg:hidden', mobileOpen ? 'translate-x-0' : '-translate-x-full')} aria-hidden={!mobileOpen}>
        {content}
      </aside>
    </>
  );
}