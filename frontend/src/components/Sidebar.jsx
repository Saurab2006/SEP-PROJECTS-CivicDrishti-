'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardList, Gauge, Landmark, LineChart, LogOut, MapPinned, Settings, Table2, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { cn, initials } from '@/lib/format';
import { CivicLogo } from './CivicBrand';
import ThemeToggle from './ThemeToggle';

const GROUPS = [
  {
    label: 'Where the money goes',
    items: [
      { href: '/dashboard', label: 'Overview', icon: Gauge },
      { href: '/budget', label: 'Budget explorer', icon: Table2 },
    ],
  },
  {
    label: 'People & decisions',
    items: [
      { href: '/issues', label: 'Civic issues', icon: ClipboardList },
      { href: '/authorities', label: 'Authorities', icon: Landmark },
      { href: '/reports', label: 'AI briefs', icon: LineChart },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const roleLabel = user?.role === 'researcher' ? 'Citizen' : user?.role === 'analyst' ? 'Local body staff' : user?.role === 'ward_rep' ? 'Ward representative' : 'Admin';
  const accessLabel = user?.role === 'admin' ? 'full access' : user?.role === 'researcher' ? 'citizen access' : 'staff access';
  const navLinkClass = (active) => cn(
    'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
    active
      ? 'bg-white/15 font-semibold text-white shadow-sm'
      : 'text-[#f4d8e7]/80 hover:bg-white/10 hover:text-white'
  );
  const navIconClass = (active) => cn(
    'h-4 w-4 shrink-0',
    active ? 'text-white' : 'text-[#f4d8e7]/70'
  );

  const isActive = (href) => pathname === href || pathname.startsWith(href + '/');

  return (
    <aside className="hidden h-screen w-[248px] shrink-0 flex-col border-r border-[#7d255b] bg-[#5f0f40] lg:flex sticky top-0">
      <div className="flex items-center justify-between px-5 py-5">
        <CivicLogo light />
        <ThemeToggle />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pt-2">
        {GROUPS.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#f7cfe3]/70">{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} className={navLinkClass(active)}>
                    <Icon className={navIconClass(active)} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {user?.role === 'admin' && (
          <div className="mb-5">
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#f7cfe3]/70">Executive</p>
            <div className="space-y-0.5">
              <Link href="/admin/users" className={navLinkClass(isActive('/admin/users'))}>
                <Users className={navIconClass(isActive('/admin/users'))} />
                User management
              </Link>
              <Link href="/admin/wards" className={navLinkClass(isActive('/admin/wards'))}>
                <MapPinned className={navIconClass(isActive('/admin/wards'))} />
                Wards & representatives
              </Link>
            </div>
          </div>
        )}

        <div className="mb-5">
          <Link href="/settings" className={navLinkClass(isActive('/settings'))}>
            <Settings className={navIconClass(isActive('/settings'))} />
            Settings
          </Link>
        </div>
      </nav>

      {user && (
        <div className="flex items-center gap-2.5 border-t border-white/10 px-4 py-3.5">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/15 text-xs font-semibold text-white">
            {initials(user.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight text-white">{user.name}</p>
            <p className="truncate text-xs capitalize text-[#f4d8e7]/70">{roleLabel} · {accessLabel}</p>
          </div>
          <button onClick={logout} title="Sign out" className="shrink-0 rounded-md p-1.5 text-[#f4d8e7]/70 transition-colors hover:bg-white/10 hover:text-white">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      )}
    </aside>
  );
}
