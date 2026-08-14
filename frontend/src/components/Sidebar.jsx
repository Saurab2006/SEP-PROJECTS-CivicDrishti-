'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardList, Gauge, Landmark, LogOut, MapPinned, Settings, Table2, Users } from 'lucide-react';
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
    
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const roleKey = user?.role === 'researcher' ? 'role.citizen' : user?.role === 'analyst' ? 'role.analyst' : user?.role === 'ward_rep' ? 'role.wardRep' : 'role.admin';
  const accessKey = user?.role === 'admin' ? 'access.full' : user?.role === 'ward_rep' ? 'access.wardOnly' : user?.role === 'analyst' ? 'access.staff' : 'access.citizen';
  const isActive = (href) => pathname === href || pathname.startsWith(href + '/');

  const navLinkClass = (active) => cn(
    'group flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
    active
      ? 'border-[#f5f7fa] bg-white text-[#17212b] shadow-sm'
      : 'border-transparent text-[#263442] hover:border-[#aebdcb] hover:bg-white/55 hover:text-[#17212b]'
  );

  const iconClass = (active) => cn(
    'h-4 w-4 shrink-0',
    active ? 'text-[var(--gov-primary)]' : 'text-[#4e6174] group-hover:text-[#17212b]'
  );

  return (
    <aside className="sticky top-0 hidden h-screen w-[276px] shrink-0 border-r border-[#aebdcb] bg-[#bcc8d5] lg:flex lg:flex-col">
      <div className="border-b border-[#aebdcb] px-5 py-5">
        <CivicLogo />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {GROUPS.map((group) => (
          <section key={group.key} className="mb-6">
            <p className="px-3 pb-2 text-xs font-medium uppercase tracking-wide text-[#4e6174]">{t(group.key)}</p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} className={navLinkClass(active)}>
                    <span className={cn('grid h-8 w-8 place-items-center rounded-md', active ? 'bg-[#fff4f3]' : 'bg-white/35')}>
                      <Icon className={iconClass(active)} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium leading-5">{t(item.key)}</span>
                      <span className={cn('block truncate text-xs font-normal leading-4', active ? 'text-[#66768a]' : 'text-[#4e6174]')}>{t(item.note)}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}

        {user?.role === 'admin' && (
          <section className="mb-6">
            <p className="px-3 pb-2 text-xs font-medium uppercase tracking-wide text-[#4e6174]">{t('nav.administration')}</p>
            <div className="space-y-1">
              <Link href="/admin/users" className={navLinkClass(isActive('/admin/users'))}>
                <span className={cn('grid h-8 w-8 place-items-center rounded-md', isActive('/admin/users') ? 'bg-[#fff4f3]' : 'bg-white/35')}><Users className={iconClass(isActive('/admin/users'))} /></span>
                <span><span className="block text-sm font-medium leading-5">{t('nav.userManagement')}</span><span className={cn('block text-xs', isActive('/admin/users') ? 'text-[#66768a]' : 'text-[#4e6174]')}>{t('nav.usersNote')}</span></span>
              </Link>
              <Link href="/admin/wards" className={navLinkClass(isActive('/admin/wards'))}>
                <span className={cn('grid h-8 w-8 place-items-center rounded-md', isActive('/admin/wards') ? 'bg-[#fff4f3]' : 'bg-white/35')}><MapPinned className={iconClass(isActive('/admin/wards'))} /></span>
                <span><span className="block text-sm font-medium leading-5">{t('nav.wards')}</span><span className={cn('block text-xs', isActive('/admin/wards') ? 'text-[#66768a]' : 'text-[#4e6174]')}>{t('nav.wardsNote')}</span></span>
              </Link>
            </div>
          </section>
        )}

        <section>
          <p className="px-3 pb-2 text-xs font-medium uppercase tracking-wide text-[#4e6174]">{t('nav.account')}</p>
          <Link href="/settings" className={navLinkClass(isActive('/settings'))}>
            <span className={cn('grid h-8 w-8 place-items-center rounded-md', isActive('/settings') ? 'bg-[#fff4f3]' : 'bg-white/35')}><Settings className={iconClass(isActive('/settings'))} /></span>
            <span><span className="block text-sm font-medium leading-5">{t('nav.settings')}</span><span className={cn('block text-xs', isActive('/settings') ? 'text-[#66768a]' : 'text-[#4e6174]')}>{t('nav.settingsNote')}</span></span>
          </Link>
        </section>
      </nav>

      {user && (
        <div className="border-t border-[#aebdcb] p-4">
          <div className="flex items-center gap-3 rounded-lg bg-white/45 p-3 ring-1 ring-[#aebdcb]">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#17212b] text-sm font-semibold text-white">
              {initials(user.name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium leading-5 text-[#17212b]">{user.name}</p>
              <p className="truncate text-xs font-normal leading-4 text-[#263442]">{t(roleKey)}</p>
              <p className="truncate text-xs font-normal leading-4 text-[#4e6174]">{t(accessKey)}</p>
            </div>
            <button onClick={logout} title={t('topbar.signOut')} className="rounded-md p-2 text-[#4e6174] transition-colors hover:bg-white/55 hover:text-[#17212b]">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}


