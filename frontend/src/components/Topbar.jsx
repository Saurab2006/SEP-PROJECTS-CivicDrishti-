'use client';
import { useAuth } from '@/context/AuthContext';
import { LogOut } from 'lucide-react';
import Link from 'next/link';
import NotificationBell from './NotificationBell';
import { CivicLogo } from './CivicBrand';
import ThemeToggle from './ThemeToggle';


export default function Topbar() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[#eae4d8] bg-white/95 px-4 backdrop-blur-sm lg:hidden dark:border-[#1e2636] dark:bg-[#0e1524]/95">
      <Link href="/dashboard" className="flex items-center gap-2">
        <CivicLogo compact />
      </Link>
      <div className="flex items-center gap-1.5">
        <ThemeToggle />
        <NotificationBell />
        <button onClick={logout} className="rounded-lg p-2 text-[#a39d8d] transition-colors hover:bg-red-50 hover:text-[#dc143c] dark:text-[#6b7690] dark:hover:bg-[#2a1520]" title="Sign out">
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}