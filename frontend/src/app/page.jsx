'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CivicLogo } from '@/components/CivicBrand';
import ThemeToggle from '@/components/ThemeToggle';
import { getToken, get } from '@/lib/api';
import { AlertTriangle, BookOpen, FileText, Flag, GitBranch, Headphones, Mail, MapPin, Network, Phone, ShieldCheck, Table2, Users, UsersRound } from 'lucide-react';

const steps = [
  ['01', 'Report', 'A citizen reports a problem with photo, location, ward, and plain-language detail.'],
  ['02', 'Cluster', 'Related reports merge into one public issue so repeated complaints become stronger evidence.'],
  ['03', 'Budget', 'Ward budgets show allocated money, live spending, and completion status beside the issue.'],
  ['04', 'Assign', 'Officials assign ownership and update planned, ongoing, completed, or delayed work stages.'],
  ['05', 'Close', 'Citizens can see whether the service was fixed and whether the budget work actually closed.'],
];
const signals = [
  [GitBranch, 'Reports become evidence', 'More reports on one problem means more people affected. Priority rises with the count.'],
  [Table2, 'Budget stays visible', 'Province, district, municipality, and ward spending can be followed in one public chain.'],
  [UsersRound, 'Community keeps it honest', 'Citizens verify both the problem and the fix before a resolution feels real.'],
  [MapPin, 'Nothing sits quietly', 'Delayed work and unspent budget are visible in plain terms for every ward.'],
];

export default function LandingPage() {
  const [hasToken, setHasToken] = useState(false);
  const [notice, setNotice] = useState(null);
  useEffect(() => { setHasToken(Boolean(getToken())); get('/api/notices/public-active').then(d => setNotice(d.notice || null)).catch(() => {}); }, []);
  return (
    <main className="min-h-screen bg-[#faf9f6] text-[#25221f] dark:bg-[#0b1220] dark:text-[#e7e9ee]">
      <header className="sticky top-0 z-40 border-b border-[#e7e0d6] bg-[#faf9f6]/95 backdrop-blur dark:border-[#1e2636] dark:bg-[#0b1220]/95">
        <div className="flex h-14 w-full items-center justify-between px-4 md:px-8">
          <Link href="/" className="flex items-center"><CivicLogo /></Link>
          <nav className="flex items-center gap-4 text-sm font-bold">
            {hasToken && <Link href="/dashboard" className="text-[#4e4a45] hover:text-[#111] dark:text-[#9aa4bd] dark:hover:text-white">Dashboard</Link>}
            <Link href="/login" className="text-[#4e4a45] hover:text-[#111] dark:text-[#9aa4bd] dark:hover:text-white">Log in</Link>
            <Link href="/signup" className="rounded-lg bg-[#cf1f3b] px-3.5 py-2 text-sm text-white shadow-sm hover:bg-[#b81831]">Sign up</Link>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      {notice && <div className={notice.priority === 'urgent' ? 'border-b border-red-200 bg-red-50 px-4 py-2.5 text-red-900 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200' : 'border-b border-[#eadfce] bg-[#fff7e8] px-4 py-2.5 text-[#102a2b] dark:border-[#3a2f1a] dark:bg-[#1c1710] dark:text-[#e7e9ee]'}><div className="mx-auto flex max-w-7xl items-start gap-3"><AlertTriangle className={notice.priority === 'urgent' ? 'mt-0.5 h-4 w-4 shrink-0 text-red-600' : 'mt-0.5 h-4 w-4 shrink-0 text-[#cf1f3b]'} /><div><p className="text-xs font-black">{notice.title}</p><p className="mt-0.5 text-xs opacity-85">{notice.message}</p></div></div></div>}

      <section className="border-b border-[#e7e0d6] dark:border-[#1e2636]">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:px-8 lg:grid-cols-[1fr_420px]">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em] text-[#cf1f3b]"><span className="text-base leading-none">▸</span>जनताको आवाज, सरकारको जवाफ</p>
            <h1 className="mt-4 max-w-xl text-[30px] font-black leading-[1.05] tracking-tight text-[#282522] dark:text-[#f4f5f8] sm:text-[42px]">Reports and budgets people can trust.</h1>
            <p className="mt-4 max-w-xl text-[15px] leading-7 text-[#68615b] dark:text-[#a7b0c4]">Civicदृष्टि connects citizen reports with live public budget tracking, so every ward can see what was promised, what was spent, and what work is still unfinished.</p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              <Link href="/signup" className="rounded-lg bg-[#cf1f3b] px-4 py-2.5 text-sm font-black text-white shadow-sm hover:bg-[#b81831]">Start tracking</Link>
              <Link href="/login" className="rounded-lg border border-[#ded6cc] bg-white px-4 py-2.5 text-sm font-black text-[#25221f] hover:border-[#25221f] dark:border-[#2a3448] dark:bg-[#111a2c] dark:text-[#e7e9ee] dark:hover:border-[#e7e9ee]">Log in</Link>
            </div>
          </div>
          <div className="relative hidden lg:block">
            <div className="absolute -left-2 -top-2 h-full w-full rounded-lg border border-[#e7e0d6] dark:border-[#1e2636]" />
            <div className="absolute -left-1 -top-1 h-full w-full rounded-lg border border-[#e7e0d6] dark:border-[#1e2636]" />
            <div className="relative space-y-4 rounded-lg border border-[#e7e0d6] bg-white p-5 shadow-sm dark:border-[#1e2636] dark:bg-[#111a2c]">
              <div className="flex items-start justify-between"><div><h2 className="text-base font-black tracking-tight dark:text-[#f4f5f8]">Ward budget - Biratnagar</h2><p className="mt-1 text-xs text-[#68615b] dark:text-[#a7b0c4]">Ward 7 · Biratnagar Metropolitan City</p></div><span className="rounded-full bg-[#eef6f4] px-2.5 py-1 text-[10px] font-black uppercase text-[#0f3d3e] dark:bg-[#10261f] dark:text-[#4fd695]">Ongoing</span></div>
              <div className="grid grid-cols-2 gap-2.5 text-xs"><div className="rounded-lg bg-[#fffaf2] p-2.5 dark:bg-[#0f1729]"><p className="text-[#68615b] dark:text-[#a7b0c4]">Allocated</p><p className="mt-1 text-sm font-black dark:text-[#f4f5f8]">रू 42.5M</p></div><div className="rounded-lg bg-[#fffaf2] p-2.5 dark:bg-[#0f1729]"><p className="text-[#68615b] dark:text-[#a7b0c4]">Spent</p><p className="mt-1 text-sm font-black dark:text-[#f4f5f8]">62%</p></div></div>
              <div><div className="mb-1.5 flex justify-between text-xs"><span className="font-bold dark:text-[#e7e9ee]">Work completed</span><span className="text-[#68615b] dark:text-[#a7b0c4]">68%</span></div><div className="h-2 overflow-hidden rounded-full bg-[#eee9e2] dark:bg-[#1e2636]"><div className="h-full w-[68%] rounded-full bg-[#cf1f3b]" /></div></div>
              <div className="border-t border-[#e7e0d6] pt-3 dark:border-[#1e2636]"><p className="flex items-center gap-2 text-xs text-[#68615b] dark:text-[#a7b0c4]"><Network className="h-3.5 w-3.5 text-[#cf1f3b]" />Reports, spend, and completion linked in one public record</p></div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[#e7e0d6] bg-white dark:border-[#1e2636] dark:bg-[#0e1524]"><div className="mx-auto max-w-6xl px-4 py-14 md:px-8"><h2 className="text-xl font-black tracking-tight dark:text-[#f4f5f8]">From report to budget to completion - in public</h2><div className="mt-8 grid gap-8 md:grid-cols-5">{steps.map(([num,title,copy]) => <div key={num}><p className="text-2xl font-black text-[#cf1f3b]">{num}</p><h3 className="mt-3 text-sm font-black dark:text-[#e7e9ee]">{title}</h3><p className="mt-2 text-xs leading-6 text-[#68615b] dark:text-[#a7b0c4]">{copy}</p></div>)}</div></div></section>
      <section className="bg-[#faf9f6] dark:bg-[#0b1220]"><div className="mx-auto grid max-w-6xl gap-x-16 gap-y-8 px-4 py-14 md:px-8 md:grid-cols-2">{signals.map(([Icon,title,copy]) => <div key={title} className="flex gap-4"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#fff0f2] dark:bg-[#2a1520]"><Icon className="h-4 w-4 text-[#cf1f3b]" /></div><div><h3 className="text-sm font-black dark:text-[#e7e9ee]">{title}</h3><p className="mt-1.5 text-xs leading-6 text-[#68615b] dark:text-[#a7b0c4]">{copy}</p></div></div>)}</div></section>
      <footer className="bg-white px-4 pb-10 pt-8 dark:bg-[#0e1524] md:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col divide-y divide-[#aab6c4]/60 rounded-2xl bg-[#dbe1ea] p-5 dark:bg-[#1a2433] dark:divide-white/10 sm:p-6 md:flex-row md:divide-x md:divide-y-0">
            <div className="flex items-start gap-3 pb-5 sm:gap-4 md:w-1/2 md:pb-0 md:pr-8">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-[#17212b] shadow-sm dark:bg-[#0e1524] dark:text-[#e7e9ee] sm:h-12 sm:w-12"><Headphones className="h-4 w-4 sm:h-5 sm:w-5" /></span>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-[#17212b] dark:text-white sm:text-base">Customer support</h3>
                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#3c4753] dark:text-[#c7cede] sm:text-sm">
                  <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" /><a href="mailto:support@civicdrishti.gov.np" className="hover:underline">support@civicdrishti.gov.np</a></span>
                  <span className="text-[#aab6c4]">|</span>
                  <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" /><a href="tel:015971234" className="hover:underline">01-5971234</a></span>
                </div>
                <p className="mt-2 text-[11px] leading-5 text-[#5c6a76] dark:text-[#8792a8] sm:text-xs">We're here to help you. Reach out for any queries or assistance.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 pt-5 sm:gap-4 md:w-1/2 md:pt-0 md:pl-8">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-[#17212b] shadow-sm dark:bg-[#0e1524] dark:text-[#e7e9ee] sm:h-12 sm:w-12"><BookOpen className="h-4 w-4 sm:h-5 sm:w-5" /></span>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-[#17212b] dark:text-white sm:text-base">Guidelines</h3>
                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-[#3c4753] dark:text-[#c7cede] sm:text-sm">
                  <Link href="/terms" className="flex items-center gap-1.5 hover:underline"><FileText className="hidden h-3.5 w-3.5 shrink-0 sm:inline" />Terms of Use</Link>
                  <span className="text-[#aab6c4]">|</span>
                  <Link href="/privacy" className="flex items-center gap-1.5 hover:underline"><ShieldCheck className="hidden h-3.5 w-3.5 shrink-0 sm:inline" />Privacy Policy</Link>
                  <span className="text-[#aab6c4]">|</span>
                  <Link href="/community-guidelines" className="flex items-center gap-1.5 hover:underline"><Users className="hidden h-3.5 w-3.5 shrink-0 sm:inline" />Community Guidelines</Link>
                  <span className="text-[#aab6c4]">|</span>
                  <Link href="/reporting-guidelines" className="flex items-center gap-1.5 hover:underline"><Flag className="hidden h-3.5 w-3.5 shrink-0 sm:inline" />Reporting Guidelines</Link>
                </div>
              </div>
            </div>
          </div>

          <p className="mt-4 text-center text-xs text-[#68615b] dark:text-[#8792a8]">&copy; {new Date().getFullYear()} <Link href="/" className="font-semibold text-[#17212b] hover:underline dark:text-[#e7e9ee]">Civicदृष्टि</Link>. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}