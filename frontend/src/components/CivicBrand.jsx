'use client';
import { useId } from 'react';
import { Link2, ShieldCheck } from 'lucide-react';

export function NepalCivicMark({ className = 'h-10 w-10' }) {
  // Every instance needs its own gradient id -- when this mark is rendered
  // more than once on the same page (mobile + desktop sidebar, topbar,
  // responsive auth layouts, etc.) a shared hardcoded id means only the
  // first <svg> paints; the rest silently render blank.
  const gradientId = useId();
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="Civicदृष्टि mark">
      <defs>
        <linearGradient id={gradientId} x1="10" y1="8" x2="54" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#dc143c" />
          <stop offset="1" stopColor="#0f3d3e" />
        </linearGradient>
      </defs>
      <path d="M16 8v48h36L27 34h19L16 8Z" fill={`url(#${gradientId})`} />
      <path d="M16 8v48h36L27 34h19L16 8Z" fill="none" stroke="#fff7ec" strokeWidth="3" strokeLinejoin="round" />
      <circle cx="28" cy="25" r="5" fill="#fff7ec" />
      <path d="M22 45h18M25 40h12M28 35h6" stroke="#fff7ec" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function CivicLogo({ compact = false, light = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative grid h-10 w-10 place-items-center rounded-lg bg-[#fff7ec] shadow-sm">
        <NepalCivicMark className="h-9 w-9" />
        <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full border-2 border-white bg-[#0f3d3e]">
          <Link2 className="h-2.5 w-2.5 text-white" />
        </span>
      </div>
      {!compact && (
        <div className="leading-tight">
          <p className={light ? 'text-sm font-extrabold tracking-tight text-white' : 'text-sm font-extrabold tracking-tight text-[#102a2b]'}>
            Civic<span className="font-extrabold">दृष्टि</span>
          </p>
          <p className={light ? 'text-[9px] font-bold uppercase tracking-[0.28em] text-white/70' : 'text-[9px] font-bold uppercase tracking-[0.28em] text-[#8c8272]'}>Civic Archive</p>
        </div>
      )}
    </div>
  );
}

export function CivicTrustStrip({ className = '' }) {
  return (
    <div className={`grid grid-cols-3 gap-2 text-center ${className}`}>
      {[
        ['Report', 'citizens raise real ward problems'],
        ['Budget', 'public money is tracked to ward level'],
        ['Resolve', 'offices close the loop in public'],
      ].map(([title, copy]) => (
        <div key={title} className="rounded-lg border border-white/15 bg-white/10 p-3">
          <p className="text-sm font-bold text-white">{title}</p>
          <p className="mt-1 text-[11px] leading-snug text-white/65">{copy}</p>
        </div>
      ))}
    </div>
  );
}

export function CivicBadge({ children }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#f0d0d5] bg-[#fff7f8] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#b80f31]">
      <ShieldCheck className="h-3.5 w-3.5" />
      {children}
    </span>
  );
}