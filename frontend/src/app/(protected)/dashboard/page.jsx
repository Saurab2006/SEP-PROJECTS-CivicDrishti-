'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { get } from '@/lib/api';
import { formatNPR, formatNumber, cn } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Languages } from 'lucide-react';

const SEVERITY_STYLE = {
  critical: 'bg-red-50 text-red-700',
  high: 'bg-red-50 text-red-700',
  medium: 'bg-amber-50 text-amber-700',
  low: 'bg-[#f1efe8] text-[#5c574c]',
};

const STATUS_LABEL = {
  pending: 'Reported',
  verified: 'Verified',
  assigned: 'Assigned',
  'in-progress': 'In progress',
  completed: 'Completed',
  rejected: 'Rejected',
  duplicate: 'Duplicate',
};

const STATUS_STYLE = {
  pending: 'bg-[#f1efe8] text-[#5c574c]',
  verified: 'bg-blue-50 text-blue-700',
  assigned: 'bg-emerald-50 text-emerald-700',
  'in-progress': 'bg-amber-50 text-amber-700',
  completed: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-700',
  duplicate: 'bg-[#f1efe8] text-[#5c574c]',
};

function reportCode(id) {
  return 'IS-' + String(id || '').slice(-4).toUpperCase();
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { locale, toggleLocale, t } = useLanguage();
  const [data, setData] = useState(null);
  const [reportStats, setReportStats] = useState(null);
  const [reports, setReports] = useState(null);
  const [loading, setLoading] = useState(true);
  const firstName = (user?.name || '').split(' ')[0];

  useEffect(() => {
    Promise.all([
      get('/api/analytics').catch(() => null),
      get('/api/reports/stats').catch(() => null),
      get('/api/reports').catch(() => null),
    ]).then(([analytics, stats, reportsRes]) => {
      setData(analytics);
      setReportStats(stats);
      setReports((reportsRes?.reports || []).slice(0, 6));
      setLoading(false);
    });
  }, []);

  const Skeleton = ({ className }) => <div className={cn('shimmer rounded-md', className)} />;
  const k = data?.kpis || {};

  const kpis = [
    { label: 'Citizen reports', value: reportStats ? formatNumber(reportStats.total || 0) : null, sub: 'people asking for action' },
    { label: 'Needs attention', value: reportStats ? formatNumber((reportStats.pending || 0) + (reportStats.active || 0)) : null, sub: 'waiting, assigned, or in progress' },
    { label: 'Closed loop', value: reportStats ? formatNumber(reportStats.completed || 0) : null, sub: 'resolved with a record' },
    { label: 'Public budget', value: loading ? null : formatNPR(k.totalBudget || 0), sub: 'money behind services' },
  ];

  return (
    <div className="mx-auto max-w-[1200px]">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#eae4d8] pb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#cf1f3b]">
            {t('dashboard.namaste')}{firstName ? `, ${firstName.toUpperCase()}` : ''}
          </p>
          <h1 className="mt-2 text-[28px] font-semibold tracking-tight text-[#102a2b]">{t('dashboard.pageTitle')}</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#65706c]">
            {user?.role === 'ward_rep'
              ? `You're approved for ${user?.wardRepresentativeApplication?.province || 'your province'}, ${user?.wardRepresentativeApplication?.district || 'your district'}, ${user?.wardRepresentativeApplication?.municipality || 'your municipality'}, Ward ${user?.wardRepresentativeApplication?.ward || ''}.`
              : t('dashboard.heroSubtitle')}
          </p>
        </div>
        <button
          onClick={toggleLocale}
          className="flex shrink-0 items-center gap-1 rounded-full border border-[#eae4d8] bg-white p-1 text-xs font-semibold"
        >
          <span className={cn('flex items-center gap-1 rounded-full px-2.5 py-1', locale === 'en' ? 'bg-[#102a2b] text-white' : 'text-[#8c8272]')}>EN</span>
          <span className={cn('flex items-center gap-1 rounded-full px-2.5 py-1', locale === 'ne' ? 'bg-[#102a2b] text-white' : 'text-[#8c8272]')}>
            <Languages className="h-3 w-3" /> नेपाली
          </span>
        </button>
      </div>

      {/* Headline numbers */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-[#102a2b]">{t('dashboard.headlineTitle')}</h2>
        <p className="mt-0.5 text-sm text-[#8c8272]">{t('dashboard.headlineSubtitle')}</p>
        <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {kpis.map((c) => (
            <div key={c.label} className="rounded-lg border border-[#eae4d8] bg-white p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#a39d8d]">{c.label}</p>
              {c.value === null ? <Skeleton className="mt-2 h-7 w-24" /> : <p className="mt-2 text-2xl font-semibold tracking-tight text-[#102a2b]">{c.value}</p>}
              <p className="mt-1 text-xs text-[#a39d8d]">{c.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Trend charts */}
      <div className="mt-10">
        <h2 className="text-lg font-semibold text-[#102a2b]">{t('dashboard.trendTitle')}</h2>
        <p className="mt-0.5 text-sm text-[#8c8272]">{t('dashboard.trendSubtitle')}</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-[#eae4d8] bg-white p-5">
            <p className="text-sm font-semibold text-[#102a2b]">{t('dashboard.budgetPanelTitle')}</p>
            <p className="text-xs text-[#a39d8d]">{t('dashboard.budgetPanelSubtitle')}</p>
            <div className="mt-4">
              {loading ? <Skeleton className="h-[220px]" /> : !(data?.budgetTrend || []).length ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={data.budgetTrend}>
                    <defs><linearGradient id="civicArea" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#102a2b" stopOpacity={0.12} /><stop offset="95%" stopColor="#102a2b" stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid vertical={false} stroke="#f0ebdf" />
                    <XAxis dataKey="key" tick={{ fontSize: 11, fill: '#a39d8d' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#a39d8d' }} axisLine={false} tickLine={false} tickFormatter={v => formatNPR(v)} width={70} />
                    <Tooltip formatter={(v) => formatNPR(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #eae4d8' }} />
                    <Area type="monotone" dataKey="value" stroke="#102a2b" strokeWidth={2} fill="url(#civicArea)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-[#eae4d8] bg-white p-5">
            <p className="text-sm font-semibold text-[#102a2b]">{t('dashboard.deptPanelTitle')}</p>
            <p className="text-xs text-[#a39d8d]">{t('dashboard.deptPanelSubtitle')}</p>
            <div className="mt-4">
              {loading ? <Skeleton className="h-[220px]" /> : !(data?.topDepartments || []).length ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={(data.topDepartments || []).slice(0, 6)} layout="vertical" margin={{ left: 8 }}>
                    <CartesianGrid horizontal={false} stroke="#f0ebdf" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#a39d8d' }} axisLine={false} tickLine={false} tickFormatter={v => formatNPR(v)} />
                    <YAxis type="category" dataKey="key" tick={{ fontSize: 11, fill: '#5c574c' }} axisLine={false} tickLine={false} width={90} />
                    <Tooltip formatter={(v) => formatNPR(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #eae4d8' }} />
                    <Bar dataKey="value" fill="#102a2b" radius={[0, 4, 4, 0]} barSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Latest civic reports */}
      <div className="mt-10 mb-10">
        <h2 className="text-lg font-semibold text-[#102a2b]">{t('dashboard.reportsTitle')}</h2>
        <p className="mt-0.5 text-sm text-[#8c8272]">{t('dashboard.reportsSubtitle')}</p>

        <div className="mt-4 overflow-hidden rounded-lg border border-[#eae4d8] bg-white">
          <div className="border-b border-[#eae4d8] px-5 py-4">
            <p className="text-sm font-semibold text-[#102a2b]">{t('dashboard.latestReports')}</p>
            <p className="text-xs text-[#a39d8d]">{t('dashboard.latestReportsSub')}</p>
          </div>

          {loading ? (
            <div className="divide-y divide-[#f0ebdf]">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-4"><Skeleton className="h-4 w-14" /><Skeleton className="h-4 flex-1" /><Skeleton className="h-4 w-24" /></div>
              ))}
            </div>
          ) : !reports?.length ? (
            <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <p className="text-sm font-semibold text-[#102a2b]">{t('dashboard.noReports')}</p>
              <p className="mt-1 max-w-[32ch] text-xs text-[#a39d8d]">{t('dashboard.noReportsSub')}</p>
              <Link href="/issues" className="mt-4 rounded-md bg-[#102a2b] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0c2021]">
                Report the first issue
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-[#f0ebdf]">
              {reports.map((r) => (
                <Link key={r._id} href={`/issues/${r._id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-3.5 transition-colors hover:bg-[#faf9f5]">
                  <span className="w-16 shrink-0 text-xs font-medium text-[#a39d8d]">{reportCode(r._id)}</span>
                  <span className="min-w-[220px] flex-1 truncate text-sm font-medium text-[#102a2b]">{r.title}</span>
                  <span className="shrink-0 text-xs text-[#a39d8d]">
                    {[r.location?.municipality || r.location?.district, r.location?.district && r.location?.municipality ? r.location.district : null].filter(Boolean).join(', ')}
                    {r.location?.ward ? ` · Ward ${r.location.ward}` : ''}
                  </span>
                  <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize', SEVERITY_STYLE[r.severity] || SEVERITY_STYLE.low)}>{r.severity || 'low'}</span>
                  <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold', STATUS_STYLE[r.status] || STATUS_STYLE.pending)}>{STATUS_LABEL[r.status] || r.status}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-[220px] items-center justify-center rounded-md bg-[#faf9f5] text-xs text-[#a39d8d]">
      No data yet
    </div>
  );
}