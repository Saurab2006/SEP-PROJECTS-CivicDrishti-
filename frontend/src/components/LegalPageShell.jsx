'use client';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { CivicLogo } from '@/components/CivicBrand';

export default function LegalPageShell({ title, updated, children }) {
  return (
    <main className="min-h-screen bg-[#faf9f6] text-[#25221f] dark:bg-[#0b1220] dark:text-[#e7e9ee]">
      <header className="sticky top-0 z-40 border-b border-[#e7e0d6] bg-[#faf9f6]/95 backdrop-blur dark:border-[#1e2636] dark:bg-[#0b1220]/95">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4 md:px-0">
          <Link href="/" className="flex items-center"><CivicLogo /></Link>
          <Link href="/" className="flex items-center gap-1.5 text-sm font-bold text-[#4e4a45] hover:text-[#111] dark:text-[#9aa4bd] dark:hover:text-white">
            <ArrowLeft className="h-4 w-4" />Back to home
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-12 md:px-0">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#cf1f3b]">Civicदृष्टि</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">{title}</h1>
        {updated && <p className="mt-2 text-xs text-[#8c8272] dark:text-[#8792a8]">Last updated: {updated}</p>}
        <div className="mt-8 space-y-6 text-sm leading-7 text-[#4e4a45] dark:text-[#c7cede]">
          {children}
        </div>
      </div>
    </main>
  );
}

export function LegalSection({ title, children }) {
  return (
    <section>
      <h2 className="text-base font-black text-[#25221f] dark:text-white">{title}</h2>
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  );
}