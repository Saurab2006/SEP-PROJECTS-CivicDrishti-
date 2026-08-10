'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CivicLogo } from '@/components/CivicBrand';
import { getToken, get } from '@/lib/api';
import { AlertTriangle, GitBranch, MapPin, Network, Table2, UsersRound } from 'lucide-react';

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
    <main className="min-h-screen bg-[#faf9f6] text-[#25221f]">
      <header className="sticky top-0 z-40 border-b border-[#e7e0d6] bg-[#faf9f6]/95 backdrop-blur">
        <div className="flex h-14 w-full items-center justify-between px-4 md:px-8">
          <Link href="/" className="flex items-center"><CivicLogo /></Link>
          <nav className="flex items-center gap-4 text-sm font-bold">
            {hasToken && <Link href="/dashboard" className="text-[#4e4a45] hover:text-[#111]">Dashboard</Link>}
            <Link href="/login" className="text-[#4e4a45] hover:text-[#111]">Log in</Link>
            <Link href="/signup" className="rounded-lg bg-[#cf1f3b] px-3.5 py-2 text-sm text-white shadow-sm hover:bg-[#b81831]">Sign up</Link>
          </nav>
        </div>
      </header>

      {notice && <div className={notice.priority === 'urgent' ? 'border-b border-red-200 bg-red-50 px-4 py-2.5 text-red-900' : 'border-b border-[#eadfce] bg-[#fff7e8] px-4 py-2.5 text-[#102a2b]'}><div className="mx-auto flex max-w-7xl items-start gap-3"><AlertTriangle className={notice.priority === 'urgent' ? 'mt-0.5 h-4 w-4 shrink-0 text-red-600' : 'mt-0.5 h-4 w-4 shrink-0 text-[#cf1f3b]'} /><div><p className="text-xs font-black">{notice.title}</p><p className="mt-0.5 text-xs opacity-85">{notice.message}</p></div></div></div>}

      <section className="border-b border-[#e7e0d6]">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:px-8 lg:grid-cols-[1fr_420px]">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em] text-[#cf1f3b]"><span className="text-base leading-none">▸</span>सुनिने आवाज, दर्ज इतिहास</p>
            <h1 className="mt-4 max-w-xl text-[30px] font-black leading-[1.05] tracking-tight text-[#282522] sm:text-[42px]">Reports and budgets people can trust.</h1>
            <p className="mt-4 max-w-xl text-[15px] leading-7 text-[#68615b]">Civicदृष्टि connects citizen reports with live public budget tracking, so every ward can see what was promised, what was spent, and what work is still unfinished.</p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              <Link href="/signup" className="rounded-lg bg-[#cf1f3b] px-4 py-2.5 text-sm font-black text-white shadow-sm hover:bg-[#b81831]">Start tracking</Link>
              <Link href="/login" className="rounded-lg border border-[#ded6cc] bg-white px-4 py-2.5 text-sm font-black text-[#25221f] hover:border-[#25221f]">Log in</Link>
            </div>
          </div>
          <div className="relative hidden lg:block">
            <div className="absolute -left-2 -top-2 h-full w-full rounded-lg border border-[#e7e0d6]" />
            <div className="absolute -left-1 -top-1 h-full w-full rounded-lg border border-[#e7e0d6]" />
            <div className="relative space-y-4 rounded-lg border border-[#e7e0d6] bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between"><div><h2 className="text-base font-black tracking-tight">Ward budget - Biratnagar</h2><p className="mt-1 text-xs text-[#68615b]">Ward 7 · Biratnagar Metropolitan City</p></div><span className="rounded-full bg-[#eef6f4] px-2.5 py-1 text-[10px] font-black uppercase text-[#0f3d3e]">Ongoing</span></div>
              <div className="grid grid-cols-2 gap-2.5 text-xs"><div className="rounded-lg bg-[#fffaf2] p-2.5"><p className="text-[#68615b]">Allocated</p><p className="mt-1 text-sm font-black">रू 42.5M</p></div><div className="rounded-lg bg-[#fffaf2] p-2.5"><p className="text-[#68615b]">Spent</p><p className="mt-1 text-sm font-black">62%</p></div></div>
              <div><div className="mb-1.5 flex justify-between text-xs"><span className="font-bold">Work completed</span><span className="text-[#68615b]">68%</span></div><div className="h-2 overflow-hidden rounded-full bg-[#eee9e2]"><div className="h-full w-[68%] rounded-full bg-[#cf1f3b]" /></div></div>
              <div className="border-t border-[#e7e0d6] pt-3"><p className="flex items-center gap-2 text-xs text-[#68615b]"><Network className="h-3.5 w-3.5 text-[#cf1f3b]" />Reports, spend, and completion linked in one public record</p></div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[#e7e0d6] bg-white"><div className="mx-auto max-w-6xl px-4 py-14 md:px-8"><h2 className="text-xl font-black tracking-tight">From report to budget to completion - in public</h2><div className="mt-8 grid gap-8 md:grid-cols-5">{steps.map(([num,title,copy]) => <div key={num}><p className="text-2xl font-black text-[#cf1f3b]">{num}</p><h3 className="mt-3 text-sm font-black">{title}</h3><p className="mt-2 text-xs leading-6 text-[#68615b]">{copy}</p></div>)}</div></div></section>
      <section className="bg-[#faf9f6]"><div className="mx-auto grid max-w-6xl gap-x-16 gap-y-8 px-4 py-14 md:px-8 md:grid-cols-2">{signals.map(([Icon,title,copy]) => <div key={title} className="flex gap-4"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#fff0f2]"><Icon className="h-4 w-4 text-[#cf1f3b]" /></div><div><h3 className="text-sm font-black">{title}</h3><p className="mt-1.5 text-xs leading-6 text-[#68615b]">{copy}</p></div></div>)}</div></section>
      <footer className="bg-[#c2255c] text-white"><div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 md:flex-row md:items-center md:justify-between md:px-8"><CivicLogo light /><p className="text-sm font-semibold text-white/80">Making reports, budgets, and public work accountable in every ward.</p></div></footer>
    </main>
  );
}