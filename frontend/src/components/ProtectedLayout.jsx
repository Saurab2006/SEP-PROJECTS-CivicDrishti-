'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/format';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import MobileTabBar from './MobileTabBar';
import OfflineBanner from './OfflineBanner';
import ImportantNoticeBanner from './ImportantNoticeBanner';
import RouteProgress from './RouteProgress';


export default function ProtectedLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const toggleSidebar = () => {
    setSidebarCollapsed((current) => !current);
  };

  if (loading) {
    return (
      <div className="gov-app flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--gov-bluegray)] border-t-[var(--gov-primary)]" />
      </div>
    );
  }

  if (!user) return null;

  const isCitizen = user.role === 'researcher';

  return (
    <div className="gov-app min-h-screen overflow-x-hidden">
      <RouteProgress />
      <div className="flex min-h-screen min-w-0">
        <Sidebar collapsed={sidebarCollapsed} mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar sidebarCollapsed={sidebarCollapsed} onToggleSidebar={toggleSidebar} onMobileMenu={() => setMobileMenuOpen(true)} />
          <OfflineBanner />
          <ImportantNoticeBanner />
          <main className={cn('min-w-0 flex-1 px-3 py-4 sm:px-6 sm:py-6 lg:px-8', isCitizen && 'pb-24 lg:pb-6')}>
            {children}
          </main>
        </div>
      </div>
      {isCitizen && <MobileTabBar />}
    </div>
  );
}