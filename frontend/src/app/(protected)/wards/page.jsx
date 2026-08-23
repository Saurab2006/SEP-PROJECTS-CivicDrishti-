'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { get } from '@/lib/api';
import { cn } from '@/lib/format';
import { MapPin, ChevronRight, Building2 } from 'lucide-react';

export default function WardsPage() {
  const [wards, setWards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    get('/api/wards').then(({ wards }) => setWards(wards || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = wards.filter(w => {
    if (!q.trim()) return true;
    const s = `${w.province} ${w.district} ${w.municipality} ${w.ward}`.toLowerCase();
    return s.includes(q.trim().toLowerCase());
  });

  return (
    <div className="mx-auto max-w-[1100px] space-y-5">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#dc143c]">Civicदृष्टि transparency</p>
        <h1 className="mt-1 text-2xl font-black text-[#102a2b]">Ward Transparency</h1>
        <p className="mt-1 text-sm text-[#65706c]">See projects, budget, civic issues, documents, and notices for any ward.</p>
      </div>

      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by province, district, municipality, or ward..." className="h-10 w-full max-w-md rounded-lg border border-[#ded6c8] bg-white px-3 text-sm outline-none focus:border-[#0f3d3e]" />

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="shimmer h-24 rounded-lg" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-[#ded6c8] bg-white p-16 text-center text-[#8c8272] shadow-sm">
          <Building2 className="mx-auto mb-2 h-8 w-8 text-[#cfc4b4]" />
          No wards found.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(w => (
            <Link key={w._id} href={`/wards/${w._id}`} className="flex items-center justify-between rounded-lg border border-[#ded6c8] bg-white p-4 shadow-sm hover:border-[#0f3d3e] hover:shadow-md transition">
              <div>
                <p className="text-sm font-black text-[#102a2b] flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-[#dc143c]" />Ward {w.ward}</p>
                <p className="mt-1 text-xs text-[#65706c]">{w.municipality || w.district}{w.district && w.municipality ? `, ${w.district}` : ''}</p>
                <p className="text-[11px] text-[#8c8272]">{w.province}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-[#cfc4b4]" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}