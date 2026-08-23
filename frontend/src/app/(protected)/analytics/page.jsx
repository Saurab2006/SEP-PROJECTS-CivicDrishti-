'use client';
import { useEffect, useState } from 'react';
import { get } from '@/lib/api';
import { formatNPR } from '@/lib/format';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';

const PIE_COLORS = ['#2563EB', '#10B981', '#8B5CF6', '#06B6D4', '#F59E0B', '#EF4444', '#EC4899'];

export default function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { get('/api/analytics').then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false)); }, []);
  const Sk = ({ h }) => <div className={`shimmer rounded-xl`} style={{ height: h }} />;

  return (
    <div className="max-w-[1400px] mx-auto space-y-5">
      <div><h1 className="text-2xl font-bold text-gray-900">Analytics</h1><p className="text-sm text-gray-500 mt-1">Compare budgets across fiscal years, sectors and departments</p></div>
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Budget Trend</h3>
          {loading ? <Sk h={260} /> : <ResponsiveContainer width="100%" height={260}><AreaChart data={data.budgetTrend}><defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2563EB" stopOpacity={0.15} /><stop offset="95%" stopColor="#2563EB" stopOpacity={0} /></linearGradient></defs><XAxis dataKey="key" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 10 }} tickFormatter={v => formatNPR(v)} width={80} /><Tooltip formatter={v => formatNPR(v)} /><Area type="monotone" dataKey="value" stroke="#2563EB" strokeWidth={2.5} fill="url(#g1)" /></AreaChart></ResponsiveContainer>}
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Sector Allocation</h3>
          {loading ? <Sk h={260} /> : <ResponsiveContainer width="100%" height={260}><PieChart><Pie data={data.sectorBreakdown} dataKey="value" nameKey="key" cx="50%" cy="50%" innerRadius={58} outerRadius={95} paddingAngle={2} label={({ key }) => key.length > 10 ? key.slice(0, 9) + '…' : key} labelLine={false} fontSize={10}>{data.sectorBreakdown.map((s, i) => <Cell key={s.key} fill={s.color || PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie><Tooltip formatter={v => formatNPR(v)} /></PieChart></ResponsiveContainer>}
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Department Comparison</h3>
          {loading ? <Sk h={260} /> : <ResponsiveContainer width="100%" height={260}><BarChart data={(data.topDepartments || []).slice(0, 6)}><XAxis dataKey="key" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={50} /><YAxis tick={{ fontSize: 10 }} tickFormatter={v => formatNPR(v)} width={80} /><Tooltip formatter={v => formatNPR(v)} /><Bar dataKey="value" fill="#2563EB" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer>}
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">District Comparison</h3>
          {loading ? <Sk h={260} /> : <ResponsiveContainer width="100%" height={260}><BarChart data={(data.districts || []).slice(0, 8)}><XAxis dataKey="key" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 10 }} tickFormatter={v => formatNPR(v)} width={80} /><Tooltip formatter={v => formatNPR(v)} /><Bar dataKey="value" fill="#8B5CF6" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer>}
        </div>
      </div>
    </div>
  );
}
