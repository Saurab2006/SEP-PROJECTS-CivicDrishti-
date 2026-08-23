'use client';
import { useEffect, useState } from 'react';
import { get } from '@/lib/api';
import { formatNPR, formatNumber } from '@/lib/format';
import { Building2, ArrowRight, MapPin } from 'lucide-react';
import Link from 'next/link';

const COLORS = { 'Roads & Transport': '#2563EB', Health: '#10B981', Education: '#8B5CF6', 'Drinking Water': '#06B6D4', Agriculture: '#F59E0B', Energy: '#EF4444', 'Urban Development': '#EC4899', 'Disaster Management': '#F97316' };

export default function DepartmentsPage() {
  const [depts, setDepts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { get('/api/departments').then(d => { setDepts(d.departments || []); setLoading(false); }).catch(() => setLoading(false)); }, []);

  return (
    <div className="max-w-[1400px] mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Departments</h1>
        <p className="text-sm text-gray-500 mt-1">Implementing agencies aggregated from extracted budget lines</p>
      </div>
      {loading ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="shimmer h-[140px] rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {depts.map(d => (
            <Link key={d.name} href={`/departments/${encodeURIComponent(d.name)}`} className="group bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:border-gray-200 hover:shadow-md transition-all">
              <div className="flex items-start justify-between">
                <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-brand-500" />
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all" />
              </div>
              <h3 className="mt-3 text-sm font-semibold text-gray-900">{d.name}</h3>
              <p className="text-xl font-bold text-gray-900 mt-1 tabular-nums">{formatNPR(d.total)}</p>
              <div className="flex flex-wrap gap-1.5 mt-3">
                <span className="text-[10px] font-medium text-gray-500 bg-gray-100 rounded-md px-2 py-0.5">{formatNumber(d.count)} lines</span>
                <span className="text-[10px] font-medium text-gray-500 bg-gray-100 rounded-md px-2 py-0.5 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm" style={{ background: COLORS[d.topSector] || '#2563EB' }} />{d.topSector}</span>
                {d.districts > 0 && <span className="text-[10px] font-medium text-gray-500 bg-gray-100 rounded-md px-2 py-0.5 flex items-center gap-1"><MapPin className="w-3 h-3" />{d.districts}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
