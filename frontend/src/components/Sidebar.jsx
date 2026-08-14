'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, ClipboardList, FileText, Gauge, Landmark, LogOut, MapPinned, Settings, Table2, Users } from 'lucide-react';
import { ClipboardList, Gauge, Landmark, LogOut, MapPinned, Settings, Table2, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { cn, initials } from '@/lib/format';
import { CivicLogo } from './CivicBrand';

const GROUPS = [
  { key: 'nav.civicWork', items: [
    { href: '/dashboard', key: 'nav.dashboard', note: 'nav.overviewNote', icon: Gauge },
    { href: '/issues', key: 'nav.issues', note: 'nav.issuesNote', icon: ClipboardList },
    { href: '/budget', key: 'nav.budget', note: 'nav.budgetNote', icon: Table2 },
  ] },
  { key: 'nav.accountability', items: [
    { href: '/authorities', key: 'nav.authorities', note: 'nav.authoritiesNote', icon: Landmark },
    { href: '/reports', key: 'nav.reports', note: 'nav.briefsNote', icon: FileText },
  ] },
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
  const roleKey = user?.role === 'researcher' ? 'role.citizen' : user?.role === 'municipality_head' ? 'role.municipalityHead' : user?.role === 'ward_rep' ? 'role.wardRep' : 'role.admin';
  const accessKey = user?.role === 'admin' ? 'access.full' : user?.role === 'municipality_head' ? 'access.municipalityOnly' : user?.role === 'ward_rep' ? 'access.wardOnly' : 'access.citizen';
  const isActive = (href) => pathname === href || pathname.startsWith(href + '/');
  const navLinkClass = (active) => cn('group flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors', active ? 'border-[#f5f7fa] bg-white text-[#17212b] shadow-sm' : 'border-transparent text-[#263442] hover:border-[#aebdcb] hover:bg-white/55 hover:text-[#17212b]');
  const iconClass = (active) => cn('h-4 w-4 shrink-0', active ? 'text-[var(--gov-primary)]' : 'text-[#4e6174] group-hover:text-[#17212b]');
  const item = (href, label, note, Icon) => (
    <Link href={href} className={navLinkClass(isActive(href))}>
      <span className={cn('grid h-8 w-8 place-items-center rounded-md', isActive(href) ? 'bg-[#fff4f3]' : 'bg-white/35')}><Icon className={iconClass(isActive(href))} /></span>
      <span><span className="block text-sm font-medium leading-5">{label}</span><span className={cn('block text-xs', isActive(href) ? 'text-[#66768a]' : 'text-[#4e6174]')}>{note}</span></span>
    </Link>
  );

  return (
    <aside className="sticky top-0 hidden h-screen w-[276px] shrink-0 border-r border-[#aebdcb] bg-[#bcc8d5] lg:flex lg:flex-col">
      <div className="border-b border-[#aebdcb] px-5 py-5"><CivicLogo /></div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {GROUPS.map(group => <section key={group.key} className="mb-6"><p className="px-3 pb-2 text-xs font-medium uppercase tracking-wide text-[#4e6174]">{t(group.key)}</p><div className="space-y-1">{group.items.map(i => item(i.href, t(i.key), t(i.note), i.icon))}</div></section>)}
        {user?.role === 'municipality_head' && <section className="mb-6"><p className="px-3 pb-2 text-xs font-medium uppercase tracking-wide text-[#4e6174]">Municipality</p><div className="space-y-1">{item('/municipality/dashboard', 'Municipality dashboard', 'wards, issues, budget', Building2)}</div></section>}
        {user?.role === 'admin' && <section className="mb-6"><p className="px-3 pb-2 text-xs font-medium uppercase tracking-wide text-[#4e6174]">{t('nav.administration')}</p><div className="space-y-1">{item('/admin/users', t('nav.userManagement'), t('nav.usersNote'), Users)}{item('/admin/wards', t('nav.wards'), t('nav.wardsNote'), MapPinned)}{item('/admin/municipality-heads', 'Municipality heads', 'local government access', Building2)}</div></section>}
        <section><p className="px-3 pb-2 text-xs font-medium uppercase tracking-wide text-[#4e6174]">{t('nav.account')}</p>{item('/settings', t('nav.settings'), t('nav.settingsNote'), Settings)}</section>
      </nav>
      {user && <div className="border-t border-[#aebdcb] p-4"><div className="flex items-center gap-3 rounded-lg bg-white/45 p-3 ring-1 ring-[#aebdcb]"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#17212b] text-sm font-semibold text-white">{initials(user.name)}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium leading-5 text-[#17212b]">{user.name}</p><p className="truncate text-xs font-normal leading-4 text-[#263442]">{t(roleKey)}</p><p className="truncate text-xs font-normal leading-4 text-[#4e6174]">{t(accessKey)}</p></div><button onClick={logout} title={t('topbar.signOut')} className="rounded-md p-2 text-[#4e6174] transition-colors hover:bg-white/55 hover:text-[#17212b]"><LogOut className="h-4 w-4" /></button></div></div>}
    </aside>
  );
}
