'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight, Languages, Menu, PanelLeftClose, PanelLeftOpen, Search } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { initials } from '@/lib/format';
import NotificationBell from './NotificationBell';
import { CivicLogo } from './CivicBrand';
import ThemeToggle from './ThemeToggle';

const PAGE_KEYS = [
  ['/admin/wards', 'nav.wards'],
  ['/admin/users', 'nav.userManagement'],
  ['/admin/municipality-heads', 'nav.municipalityHeads'],
  ['/municipality/dashboard', 'nav.municipalityDashboard'],
  ['/dashboard', 'nav.dashboard'],
  ['/issues', 'nav.issues'],
  ['/budget', 'nav.budget'],
  ['/authorities', 'nav.authorities'],
  ['/reports', 'nav.reports'],
  ['/settings', 'nav.settings'],
];

export default function Topbar({ sidebarCollapsed = false, onToggleSidebar, onMobileMenu }) {
  const { user } = useAuth();
  const { locale, toggleLocale, t } = useLanguage();
  const pathname = usePathname();
  if (!user) return null;

  const pageKey = PAGE_KEYS.find(([href]) => pathname === href || pathname.startsWith(href + '/'))?.[1] || 'dashboard.title';
  const pageTitle = t(pageKey);
  const roleKey = user.role === 'admin' ? 'role.admin' : user.role === 'ward_rep' ? 'role.wardRep' : user.role === 'municipality_head' ? 'role.municipalityHead' : 'role.citizen';
  const CollapseIcon = sidebarCollapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--gov-border)] bg-white/95 backdrop-blur dark:bg-[#111827]/95">
      <div className="flex min-h-[64px] items-center justify-between gap-3 px-3 sm:min-h-[72px] sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button type="button" onClick={onMobileMenu} className="grid h-10 w-10 place-items-center rounded-lg border border-[var(--gov-border)] text-[var(--gov-muted)] hover:bg-[#f6f8fb] lg:hidden" aria-label="Open menu" aria-expanded={false}>
            <Menu className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={onToggleSidebar}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!sidebarCollapsed}
            className="hidden h-10 w-10 place-items-center rounded-lg border border-[var(--gov-border)] text-[var(--gov-muted)] transition-colors hover:bg-[#f6f8fb] focus:outline-none focus:ring-2 focus:ring-[var(--gov-primary)]/30 lg:grid"
          >
            <CollapseIcon className="h-4 w-4" />
          </button>
          <Link href="/dashboard" className="lg:hidden"><CivicLogo compact /></Link>
          <div className="hidden lg:block">
            <p className="gov-label uppercase">{t('topbar.workspace')}</p>
            <h1 className="mt-1 text-xl font-semibold leading-7 text-[var(--gov-text)]">{pageTitle}</h1>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-3">
          <label className="hidden h-10 w-full max-w-xl items-center gap-2 rounded-lg border border-[var(--gov-border)] bg-[#fbfcfe] px-3 text-sm text-[var(--gov-muted)] dark:bg-[#0f172a] md:flex">
            <Search className="h-4 w-4 text-[var(--gov-subtle)]" />
            <input className="w-full bg-transparent text-sm font-normal outline-none placeholder:text-[var(--gov-subtle)]" placeholder={t('topbar.search')} />
          </label>
          <button className="hidden h-10 w-10 place-items-center rounded-lg border border-[var(--gov-border)] bg-white text-[var(--gov-muted)] transition-colors hover:bg-[#f6f8fb] dark:bg-[#0f172a] sm:grid md:hidden" title="Search">
            <Search className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={toggleLocale}
            title={t('topbar.language')}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--gov-border)] bg-white px-3 text-sm font-medium text-[var(--gov-muted)] transition-colors hover:bg-[#f6f8fb] dark:bg-[#0f172a]"
          >
            <Languages className="h-4 w-4" />
            <span className="hidden md:inline">{locale === 'en' ? 'नेपाली' : 'English'}</span>
          </button>
          <ThemeToggle className="!h-10 inline-flex" />
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

      <div className="border-t border-[var(--gov-border)] px-3 py-2 lg:hidden">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--gov-muted)]">{pageTitle}</p>
      </div>
    </header>
  );
}