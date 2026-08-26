'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardList, Gauge, Landmark, MapPinned, Settings, Table2 } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { cn } from '@/lib/format';

const TABS = [
  { href: '/dashboard', key: 'nav.dashboard', icon: Gauge },
  { href: '/issues', key: 'nav.issues', icon: ClipboardList },
  { href: '/budget', key: 'nav.budget', icon: Table2 },
  { href: '/wards', key: 'nav.wards', icon: MapPinned },
  { href: '/settings', key: 'nav.settings', icon: Settings },
];

export default function MobileTabBar() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const isActive = (href) => pathname === href || pathname.startsWith(href + '/');

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--gov-border)] bg-white/95 backdrop-blur dark:border-[#1e2636] dark:bg-[#111827]/95 lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Primary"
    >
      <div className="grid grid-cols-5">
        {TABS.map(({ href, key, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className="flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium"
            >
              <Icon className={cn('h-5 w-5', active ? 'text-[var(--gov-primary)]' : 'text-[var(--gov-muted)]')} />
              <span className={cn('truncate px-0.5', active ? 'text-[var(--gov-primary)]' : 'text-[var(--gov-muted)]')}>{t(key)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}