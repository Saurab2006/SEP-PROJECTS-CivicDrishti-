'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { get } from '@/lib/api';
import { formatNPR, formatNumber } from '@/lib/format';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Wallet, FileText, MapPin } from 'lucide-react';
import Link from 'next/link';

const PIE_COLORS = ['#2563EB', '#10B981', '#8B5CF6', '#06B6D4', '#F59E0B', '#EF4444', '#EC4899'];

export default function DeptDetail() {
  const params = useParams();
  const name = decodeURIComponent(params.id);
  const [dept, setDept] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { get(`/api/departments?name=${encodeURIComponent(name)}`).then(d => { setDept(d.department); setLoading(false); }).catch(() => setLoading(false)); }, [name]);

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!dept) return <div className="text-center py-20 text-gray-500">Department not found</div>;

  return (
    <div className="max-w-[1400px] mx-auto space-y-5">
      <div><Link href="/departments" className="text-xs text-brand-500 hover:underline">← Back to departments</Link><h1 className="text-2xl font-bold text-gray-900 mt-2">{name}</h1></div>

      <div className="grid grid-cols-3 gap-4">
        {[{ l: 'Total', v: formatNPR(dept.total), i: Wallet }, { l: 'Budget Lines', v: formatNumber(dept.count), i: FileText }, { l: 'Districts', v: formatNumber(dept.districts), i: MapPin }].map((s, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2"><span className="text-xs font-medium text-gray-500">{s.l}</span><s.i className="w-4 h-4 text-gray-400" /></div>
            <p className="text-xl font-bold text-gray-900 tabular-nums">{s.v}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Allocation by Fiscal Year</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={dept.trend}><XAxis dataKey="key" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 10 }} tickFormatter={v => formatNPR(v)} width={80} /><Tooltip formatter={v => formatNPR(v)} /><Bar dataKey="value" fill="#2563EB" radius={[6, 6, 0, 0]} /></BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Sector Mix</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart><Pie data={dept.sectors} dataKey="value" nameKey="key" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2} label={({ key }) => key.length > 10 ? key.slice(0, 9) + '…' : key} labelLine={false} fontSize={10}>
              {dept.sectors.map((s, i) => <Cell key={s.key} fill={s.color || PIE_COLORS[i % PIE_COLORS.length]} />)}
            </Pie><Tooltip formatter={v => formatNPR(v)} /></PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100"><h3 className="text-sm font-semibold text-gray-900">Budget Lines ({dept.lines.length})</h3></div>
        <ul className="divide-y divide-gray-50">
          {dept.lines.map(l => (
            <li key={l._id} className="px-5 py-3 flex items-center justify-between gap-4 hover:bg-gray-50/60">
              <div className="min-w-0"><p className="text-sm font-medium text-gray-900 truncate">{l.title}</p><p className="text-xs text-gray-400">{l.sector} · FY {l.fiscalYear}{l.district && ` · ${l.district}`}</p></div>
              <span className="text-sm font-semibold text-gray-900 tabular-nums shrink-0">{formatNPR(l.amount)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
