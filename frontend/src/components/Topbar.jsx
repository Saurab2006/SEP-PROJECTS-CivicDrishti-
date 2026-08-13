'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardList, Gauge, Languages, Search, Table2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { cn, initials } from '@/lib/format';
import NotificationBell from './NotificationBell';
import { CivicLogo } from './CivicBrand';
import ThemeToggle from './ThemeToggle';

const PAGE_KEYS = [
  ['/admin/wards', 'nav.wards'],
  ['/admin/users', 'nav.userManagement'],
  ['/dashboard', 'nav.dashboard'],
  ['/issues', 'nav.issues'],
  ['/budget', 'nav.budget'],
  ['/authorities', 'nav.authorities'],
  ['/reports', 'nav.reports'],
  ['/settings', 'nav.settings'],
];

const MOBILE_NAV = [
  { href: '/dashboard', key: 'nav.dashboard', icon: Gauge },
  { href: '/issues', key: 'nav.issues', icon: ClipboardList },
  { href: '/budget', key: 'nav.budget', icon: Table2 },
];

export default function Topbar() {
  const { user } = useAuth();
  const { locale, toggleLocale, t } = useLanguage();
  const pathname = usePathname();
  if (!user) return null;

  const pageKey = PAGE_KEYS.find(([href]) => pathname === href || pathname.startsWith(href + '/'))?.[1] || 'dashboard.title';
  const pageTitle = t(pageKey);
  const roleKey = user.role === 'admin' ? 'role.admin' : user.role === 'ward_rep' ? 'role.wardRep' : user.role === 'analyst' ? 'role.analyst' : 'role.citizen';

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--gov-border)] bg-white/95 backdrop-blur dark:bg-[#111827]/95">
      <div className="flex min-h-[72px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/dashboard" className="lg:hidden"><CivicLogo compact /></Link>
          <div className="hidden lg:block">
            <p className="gov-label uppercase">{t('topbar.workspace')}</p>
            <h1 className="mt-1 text-xl font-semibold leading-7 text-[var(--gov-text)]">{pageTitle}</h1>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-end gap-3">
          <label className="hidden h-10 w-full max-w-md items-center gap-2 rounded-lg border border-[var(--gov-border)] bg-[#fbfcfe] px-3 text-sm text-[var(--gov-muted)] dark:bg-[#0f172a] md:flex">
            <Search className="h-4 w-4 text-[var(--gov-subtle)]" />
            <input className="w-full bg-transparent text-sm font-normal outline-none placeholder:text-[var(--gov-subtle)]" placeholder={t('topbar.search')} />
          </label>
          <button className="grid h-10 w-10 place-items-center rounded-lg border border-[var(--gov-border)] bg-white text-[var(--gov-muted)] transition-colors hover:bg-[#f6f8fb] dark:bg-[#0f172a] md:hidden" title="Search">
            <Search className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={toggleLocale}
            title={t('topbar.language')}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--gov-border)] bg-white px-3 text-sm font-medium text-[var(--gov-muted)] transition-colors hover:bg-[#f6f8fb] dark:bg-[#0f172a]"
          >
            <Languages className="h-4 w-4" />
            <span className="hidden sm:inline">{locale === 'en' ? 'नेपाली' : 'English'}</span>
          </button>
          <ThemeToggle className="!h-10" />
          <NotificationBell />
          <div className="hidden items-center gap-2 rounded-lg border border-[var(--gov-border)] bg-white px-2.5 py-1.5 dark:bg-[#0f172a] sm:flex">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-[#edf2f7] text-xs font-semibold text-[var(--gov-text)] dark:bg-[#1f2937]">{initials(user.name)}</div>
            <div className="min-w-0">
              <p className="max-w-[120px] truncate text-sm font-medium leading-5 text-[var(--gov-text)]">{user.name}</p>
              <p className="text-xs font-normal leading-4 text-[var(--gov-subtle)]">{t(roleKey)}</p>
            </div>
          </div>
        </div>
      </div>

      <nav className="flex gap-2 overflow-x-auto border-t border-[var(--gov-border)] px-4 py-2 lg:hidden">
        {MOBILE_NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className={cn('flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium', active ? 'bg-[#fff4f3] text-[var(--gov-primary)] dark:bg-[#2a1518]' : 'text-[var(--gov-muted)]')}>
              <Icon className="h-4 w-4" />{t(item.key)}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
