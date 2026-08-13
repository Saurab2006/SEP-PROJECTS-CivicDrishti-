'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { get } from '@/lib/api';
import { formatNPR, formatNumber, cn } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useTheme } from '@/context/ThemeContext';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Languages } from 'lucide-react';

const SEVERITY_STYLE = {
  critical: 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300',
  high: 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300',
  medium: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
  low: 'bg-[#f1efe8] text-[#5c574c] dark:bg-[#1a2334] dark:text-[#9aa4bd]',
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
  pending: 'bg-[#f1efe8] text-[#5c574c] dark:bg-[#1a2334] dark:text-[#9aa4bd]',
  verified: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
  assigned: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  'in-progress': 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
  completed: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  rejected: 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300',
  duplicate: 'bg-[#f1efe8] text-[#5c574c] dark:bg-[#1a2334] dark:text-[#9aa4bd]',
};

function reportCode(id) {
  return 'IS-' + String(id || '').slice(-4).toUpperCase();
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { locale, toggleLocale, t } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
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

  const Skeleton = ({ className }) => <div className={cn('shimmer rounded-md dark:bg-[#1a2334]', className)} />;
  const k = data?.kpis || {};
  const axisColor = isDark ? '#6b7690' : '#a39d8d';
  const gridColor = isDark ? '#1e2636' : '#f0ebdf';
  const lineColor = isDark ? '#e7e9ee' : '#102a2b';
  const tooltipStyle = { fontSize: 12, borderRadius: 8, border: `1px solid ${isDark ? '#232c40' : '#eae4d8'}`, background: isDark ? '#111a2c' : '#fff', color: isDark ? '#e7e9ee' : '#102a2b' };

  const kpis = [
    { label: 'Citizen reports', value: reportStats ? formatNumber(reportStats.total || 0) : null, sub: 'people asking for action' },
    { label: 'Needs attention', value: reportStats ? formatNumber((reportStats.pending || 0) + (reportStats.active || 0)) : null, sub: 'waiting, assigned, or in progress' },
    { label: 'Closed loop', value: reportStats ? formatNumber(reportStats.completed || 0) : null, sub: 'resolved with a record' },
    { label: 'Public budget', value: loading ? null : formatNPR(k.totalBudget || 0), sub: 'money behind services', money: true },
  ];

  return (
    <div className="mx-auto max-w-[1200px]">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#eae4d8] pb-6 dark:border-[#1e2636]">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#cf1f3b]">
            {t('dashboard.namaste')}{firstName ? `, ${firstName.toUpperCase()}` : ''}
          </p>
          <h1 className="mt-2 text-[28px] font-medium tracking-tight text-[#102a2b] dark:text-[#f4f5f8]">{t('dashboard.pageTitle')}</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#65706c] dark:text-[#9aa4bd]">
            {user?.role === 'ward_rep'
              ? `You're approved for ${user?.wardRepresentativeApplication?.province || 'your province'}, ${user?.wardRepresentativeApplication?.district || 'your district'}, ${user?.wardRepresentativeApplication?.municipality || 'your municipality'}, Ward ${user?.wardRepresentativeApplication?.ward || ''}.`
              : t('dashboard.heroSubtitle')}
          </p>
        </div>
        <button
          onClick={toggleLocale}
          className="flex shrink-0 items-center gap-1 rounded-full border border-[#eae4d8] bg-white p-1 text-xs font-medium dark:border-[#232c40] dark:bg-[#111a2c]"
        >
          <span className={cn('flex items-center gap-1 rounded-full px-2.5 py-1', locale === 'en' ? 'bg-[#102a2b] text-white dark:bg-[#e7e9ee] dark:text-[#0b1220]' : 'text-[#8c8272] dark:text-[#6b7690]')}>EN</span>
          <span className={cn('flex items-center gap-1 rounded-full px-2.5 py-1', locale === 'ne' ? 'bg-[#102a2b] text-white dark:bg-[#e7e9ee] dark:text-[#0b1220]' : 'text-[#8c8272] dark:text-[#6b7690]')}>
            <Languages className="h-3 w-3" /> नेपाली
          </span>
        </button>
      </div>

      {/* Headline numbers */}
      <div className="mt-8">
        <h2 className="text-lg font-medium text-[#102a2b] dark:text-[#f4f5f8]">{t('dashboard.headlineTitle')}</h2>
        <p className="mt-0.5 text-sm text-[#8c8272] dark:text-[#9aa4bd]">{t('dashboard.headlineSubtitle')}</p>
        <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {kpis.map((c) => (
            <div key={c.label} className="rounded-lg border border-[#eae4d8] bg-white p-5 dark:border-[#1e2636] dark:bg-[#111a2c]">
              <p className="text-[11px] text-[#a39d8d] dark:text-[#6b7690]">{c.label}</p>
              {c.value === null ? <Skeleton className="mt-2 h-8 w-24" /> : <p className={cn('mt-1 text-[28px] font-medium tracking-tight', c.money ? 'text-[#0f6e56]' : 'text-[#102a2b] dark:text-[#f4f5f8]')}>{c.value}</p>}
              <p className="mt-1 text-xs text-[#a39d8d] dark:text-[#6b7690]">{c.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Trend charts */}
      <div className="mt-10">
        <h2 className="text-lg font-medium text-[#102a2b] dark:text-[#f4f5f8]">{t('dashboard.trendTitle')}</h2>
        <p className="mt-0.5 text-sm text-[#8c8272] dark:text-[#9aa4bd]">{t('dashboard.trendSubtitle')}</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-[#eae4d8] bg-white p-5 dark:border-[#1e2636] dark:bg-[#111a2c]">
            <p className="text-sm font-medium text-[#102a2b] dark:text-[#f4f5f8]">{t('dashboard.budgetPanelTitle')}</p>
            <p className="text-xs text-[#a39d8d] dark:text-[#6b7690]">{t('dashboard.budgetPanelSubtitle')}</p>
            <div className="mt-4">
              {loading ? <Skeleton className="h-[220px]" /> : !(data?.budgetTrend || []).length ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={data.budgetTrend}>
                    <defs><linearGradient id="civicArea" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={lineColor} stopOpacity={0.12} /><stop offset="95%" stopColor={lineColor} stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid vertical={false} stroke={gridColor} />
                    <XAxis dataKey="key" tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: axisColor }} axisLine={false} tickLine={false} tickFormatter={v => formatNPR(v)} width={70} />
                    <Tooltip formatter={(v) => formatNPR(v)} contentStyle={tooltipStyle} />
                    <Area type="monotone" dataKey="value" stroke={lineColor} strokeWidth={2} fill="url(#civicArea)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-[#eae4d8] bg-white p-5 dark:border-[#1e2636] dark:bg-[#111a2c]">
            <p className="text-sm font-medium text-[#102a2b] dark:text-[#f4f5f8]">{t('dashboard.deptPanelTitle')}</p>
            <p className="text-xs text-[#a39d8d] dark:text-[#6b7690]">{t('dashboard.deptPanelSubtitle')}</p>
            <div className="mt-4">
              {loading ? <Skeleton className="h-[220px]" /> : !(data?.topDepartments || []).length ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={(data.topDepartments || []).slice(0, 6)} layout="vertical" margin={{ left: 8 }}>
                    <CartesianGrid horizontal={false} stroke={gridColor} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: axisColor }} axisLine={false} tickLine={false} tickFormatter={v => formatNPR(v)} />
                    <YAxis type="category" dataKey="key" tick={{ fontSize: 11, fill: isDark ? '#9aa4bd' : '#5c574c' }} axisLine={false} tickLine={false} width={90} />
                    <Tooltip formatter={(v) => formatNPR(v)} contentStyle={tooltipStyle} />
                    <Bar dataKey="value" fill={lineColor} radius={[0, 4, 4, 0]} barSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Latest civic reports */}
      <div className="mt-10 mb-10">
        <h2 className="text-lg font-medium text-[#102a2b] dark:text-[#f4f5f8]">{t('dashboard.reportsTitle')}</h2>
        <p className="mt-0.5 text-sm text-[#8c8272] dark:text-[#9aa4bd]">{t('dashboard.reportsSubtitle')}</p>

        <div className="mt-4 overflow-hidden rounded-lg border border-[#eae4d8] bg-white dark:border-[#1e2636] dark:bg-[#111a2c]">
          <div className="border-b border-[#eae4d8] px-5 py-4 dark:border-[#1e2636]">
            <p className="text-sm font-medium text-[#102a2b] dark:text-[#f4f5f8]">{t('dashboard.latestReports')}</p>
            <p className="text-xs text-[#a39d8d] dark:text-[#6b7690]">{t('dashboard.latestReportsSub')}</p>
          </div>

          {loading ? (
            <div className="divide-y divide-[#f0ebdf] dark:divide-[#1e2636]">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-4"><Skeleton className="h-4 w-14" /><Skeleton className="h-4 flex-1" /><Skeleton className="h-4 w-24" /></div>
              ))}
            </div>
          ) : !reports?.length ? (
            <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <p className="text-sm font-medium text-[#102a2b] dark:text-[#f4f5f8]">{t('dashboard.noReports')}</p>
              <p className="mt-1 max-w-[32ch] text-xs text-[#a39d8d] dark:text-[#6b7690]">{t('dashboard.noReportsSub')}</p>
              <Link href="/issues" className="mt-4 rounded-md bg-[#102a2b] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#0c2021] dark:bg-[#e7e9ee] dark:text-[#0b1220] dark:hover:bg-white">
                Report the first issue
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-[#f0ebdf] dark:divide-[#1e2636]">
              {reports.map((r) => (
                <Link key={r._id} href={`/issues/${r._id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-3.5 transition-colors hover:bg-[#faf9f5] dark:hover:bg-[#151d2e]">
                  <span className="w-16 shrink-0 text-xs font-medium text-[#a39d8d] dark:text-[#6b7690]">{reportCode(r._id)}</span>
                  <span className="min-w-[220px] flex-1 truncate text-sm font-medium text-[#102a2b] dark:text-[#e7e9ee]">{r.title}</span>
                  <span className="shrink-0 text-xs text-[#a39d8d] dark:text-[#6b7690]">
                    {[r.location?.municipality || r.location?.district, r.location?.district && r.location?.municipality ? r.location.district : null].filter(Boolean).join(', ')}
                    {r.location?.ward ? ` · Ward ${r.location.ward}` : ''}
                  </span>
                  <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium capitalize', SEVERITY_STYLE[r.severity] || SEVERITY_STYLE.low)}>{r.severity || 'low'}</span>
                  <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium', STATUS_STYLE[r.status] || STATUS_STYLE.pending)}>{STATUS_LABEL[r.status] || r.status}</span>
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
    <div className="flex h-[220px] items-center justify-center rounded-md bg-[#faf9f5] text-xs text-[#a39d8d] dark:bg-[#0e1524] dark:text-[#6b7690]">
      No data yet
    </div>
  );
}