'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { get } from '@/lib/api';
import { formatNPR, formatNumber, cn } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { AlertCircle, ArrowRight, Building2, CheckCircle2, Clock3, FileText, Landmark, MapPin, MapPinned, ShieldCheck, Table2, WalletCards } from 'lucide-react';

const STATUS_TONE = {
  pending: 'bg-[#fff8e8] text-[#8a5a12] ring-[#f3dfb3]',
  verified: 'bg-[#eef5fb] text-[var(--gov-info)] ring-[#cbd9e8]',
  assigned: 'bg-[#eef8f3] text-[var(--gov-success)] ring-[#c8e4d6]',
  'in-progress': 'bg-[#fff8e8] text-[#8a5a12] ring-[#f3dfb3]',
  completed: 'bg-[#eef8f3] text-[var(--gov-success)] ring-[#c8e4d6]',
  rejected: 'bg-[#fff4f3] text-[var(--gov-error)] ring-[#f4bbb8]',
  duplicate: 'bg-[#f2f5f8] text-[var(--gov-muted)] ring-[var(--gov-border)]',
};

const PRIORITY_TONE = {
  critical: 'bg-[#fff4f3] text-[var(--gov-error)] ring-[#f4bbb8]',
  high: 'bg-[#fff4f3] text-[var(--gov-error)] ring-[#f4bbb8]',
  medium: 'bg-[#fff8e8] text-[#8a5a12] ring-[#f3dfb3]',
  low: 'bg-[#f2f5f8] text-[var(--gov-muted)] ring-[var(--gov-border)]',
};

function reportCode(id) {
  return 'CV-' + String(id || '').slice(-4).toUpperCase();
}

function dateLabel(value, t) {
  if (!value) return t('common.recently');
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return t('common.recently');
  return date.toLocaleDateString('en-NP', { month: 'short', day: 'numeric' });
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [reportStats, setReportStats] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [myWardBudget, setMyWardBudget] = useState(null);
  const [myWardLoading, setMyWardLoading] = useState(true);

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

  const myProvince = user?.civicLocation?.province || '';
  const myDistrict = user?.civicLocation?.district || '';
  const myMunicipality = user?.civicLocation?.municipality || '';
  const myWard = user?.civicLocation?.ward || '';

  useEffect(() => {
    if (!myWard) { setMyWardBudget(null); setMyWardLoading(false); return; }
    setMyWardLoading(true);
    const params = new URLSearchParams();
    if (myProvince) params.set('province', myProvince);
    if (myDistrict) params.set('district', myDistrict);
    // Municipality is intentionally left out of this filter: citizens type
    // it freehand in Settings (e.g. "Biratnagar") while budget records are
    // sometimes filed under the fuller official name (e.g. "Biratnagar
    // Metropolitan City"), and the backend matches it exactly. District +
    // ward is enough to reliably identify a citizen's ward.
    params.set('ward', myWard);
    params.set('limit', '5000');
    get(`/api/budgets?${params.toString()}`)
      .then((res) => {
        const wardItems = res?.items || [];
        const totals = wardItems.reduce((acc, item) => {
          const flow = item.financialFlow || {};
          acc.total += Number(flow.revisedBudget ?? item.amount ?? 0) || 0;
          acc.spent += Number(flow.paidAmount ?? item.spent ?? 0) || 0;
          acc.count += 1;
          return acc;
        }, { total: 0, spent: 0, count: 0 });
        const remaining = Math.max(0, totals.total - totals.spent);
        const progress = totals.total ? Math.min(100, Math.round((totals.spent / totals.total) * 100)) : 0;
        setMyWardBudget({ ...totals, remaining, progress });
      })
      .catch(() => setMyWardBudget(null))
      .finally(() => setMyWardLoading(false));
  }, [myProvince, myDistrict, myWard]);

  const myWardDetailsHref = `/budget?${new URLSearchParams({
    ...(myProvince ? { province: myProvince } : {}),
    ...(myDistrict ? { district: myDistrict } : {}),
    ward: myWard,
  }).toString()}`;

  const k = data?.kpis || {};
  const totalReports = reportStats?.total || 0;
  const pendingReports = (reportStats?.pending || 0) + (reportStats?.active || 0);
  const resolvedReports = reportStats?.completed || 0;
  const totalBudget = k.totalBudget || 0;
  const spentBudget = k.spentBudget || k.totalSpent || Math.round(totalBudget * 0.58);
  const remainingBudget = Math.max(totalBudget - spentBudget, 0);
  const budgetUsed = totalBudget ? Math.min(100, Math.round((spentBudget / totalBudget) * 100)) : 0;
  const topDepartments = (data?.topDepartments || []).slice(0, 4);
  const maxDepartmentValue = Math.max(...topDepartments.map((d) => d.value || 0), 1);
  const wardScope = user?.role === 'ward_rep' ? user?.wardRepresentativeApplication : null;

  const statusText = (status) => t(`status.${status || 'pending'}`);
  const priorityText = (priority) => t(`priority.${priority || 'low'}`);

  const statCards = [
    { title: t('dashboard.totalReports'), value: formatNumber(totalReports), support: t('dashboard.totalReportsSub'), icon: FileText, tone: 'text-[var(--gov-info)] bg-[#eef5fb]' },
    { title: t('dashboard.pendingReports'), value: formatNumber(pendingReports), support: t('dashboard.pendingReportsSub'), icon: Clock3, tone: 'text-[var(--gov-warning)] bg-[#fff8e8]' },
    { title: t('dashboard.resolvedReports'), value: formatNumber(resolvedReports), support: t('dashboard.resolvedReportsSub'), icon: CheckCircle2, tone: 'text-[var(--gov-success)] bg-[#eef8f3]' },
    { title: t('dashboard.publicBudget'), value: formatNPR(totalBudget), support: `${budgetUsed}% ${t('dashboard.publicBudgetSub')}`, icon: WalletCards, tone: 'text-[var(--gov-primary)] bg-[#fff4f3]' },
  ];

  const activity = useMemo(() => {
    const latest = reports.slice(0, 3).map((r) => ({
      id: r._id,
      title: r.status ? `${statusText(r.status)}: ${r.title}` : `${t('status.updated')}: ${r.title}`,
      meta: `${dateLabel(r.updatedAt || r.createdAt, t)} · ${r.assignedAuthority?.name || r.authority?.name || t('dashboard.notAssigned')}`,
      icon: r.status === 'completed' ? CheckCircle2 : r.status === 'assigned' ? Building2 : r.status === 'verified' ? ShieldCheck : AlertCircle,
    }));
    return latest.length ? latest : [
      { id: 'empty-1', title: t('dashboard.noActivity'), meta: t('dashboard.noActivitySub'), icon: Clock3 },
    ];
  }, [reports, t]);

  const showWardCard = ['researcher', 'ward_rep'].includes(user?.role);

  return (
    <div className="mx-auto max-w-[1280px] space-y-6 sm:space-y-8">
      {showWardCard && (
        <MyWardBudgetCard
          t={t}
          ward={myWard}
          municipality={myMunicipality}
          district={myDistrict}
          loading={myWardLoading}
          budget={myWardBudget}
          detailsHref={myWardDetailsHref}
        />
      )}

      <section className="grid gap-4 lg:grid-cols-[1.5fr_0.9fr]">
        <div className="gov-card p-5 sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="gov-h1 mt-2">{t('dashboard.pageTitle')}</h1>
            </div>
            <Link href="/issues" className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[var(--gov-primary)] px-4 text-sm font-medium text-white transition hover:bg-[var(--gov-primary-dark)] sm:w-auto">
              {t('dashboard.viewIssues')} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {wardScope && (
            <div className="mt-5 rounded-lg border border-[#cbd9e8] bg-[#f7fafc] p-4 dark:bg-[#111827]">
              <p className="gov-label uppercase">{t('dashboard.assignedWard')}</p>
              <p className="mt-1 text-sm font-medium text-[var(--gov-text)]">
                {wardScope.province || 'Province'} · {wardScope.district || 'District'} · {wardScope.municipality || 'Municipality'} · Ward {wardScope.ward || '-'}
              </p>
              <p className="gov-secondary mt-1">{t('dashboard.assignedWardHelp')}</p>
            </div>
          )}
          <HeroMapPreview reports={reports} loading={loading} t={t} />
        </div>

        <div className="gov-card p-5 sm:p-6">
          <p className="gov-label uppercase">{t('dashboard.budgetUse')}</p>
          <div className="mt-4 flex items-end justify-between gap-4">
            <div>
              <p className="gov-stat">{budgetUsed}%</p>
              <p className="gov-secondary mt-1">{t('dashboard.usedAllocation')}</p>
            </div>
            <Table2 className="h-9 w-9 text-[var(--gov-primary)]" />
          </div>
          <BudgetProgress percent={budgetUsed} />
          <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <BudgetMini label={t('dashboard.allocated')} value={formatNPR(totalBudget)} />
            <BudgetMini label={t('dashboard.spent')} value={formatNPR(spentBudget)} />
            <BudgetMini label={t('dashboard.remaining')} value={formatNPR(remainingBudget)} />
            <BudgetMini label={t('dashboard.activeWork')} value={formatNumber(k.activeProjects || pendingReports)} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.title} className="gov-card p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="gov-h3">{card.title}</h2>
                  <p className="gov-secondary mt-1">{card.support}</p>
                </div>
                <span className={cn('grid h-9 w-9 place-items-center rounded-lg', card.tone)}><Icon className="h-4 w-4" /></span>
              </div>
              {loading ? <Skeleton className="mt-5 h-8 w-28" /> : <p className="gov-stat mt-5">{card.value}</p>}
            </article>
          );
        })}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="gov-card p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="gov-h2">{t('dashboard.budgetOverview')}</h2>
            </div>
            <Link href="/budget" className="text-sm font-medium text-[var(--gov-primary)] hover:underline">{t('dashboard.openBudgetExplorer')}</Link>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-lg border border-[var(--gov-border)] bg-[#fbfcfe] p-4 dark:bg-[#111827]">
              <p className="gov-label uppercase">{t('dashboard.moneyStatus')}</p>
              {loading ? <Skeleton className="mt-4 h-32" /> : (
                <>
                  <div className="mt-4 space-y-4">
                    <BudgetLine label={t('dashboard.allocated')} value={formatNPR(totalBudget)} tone="bg-[#e8eef5]" />
                    <BudgetLine label={t('dashboard.spent')} value={formatNPR(spentBudget)} tone="bg-[var(--gov-primary)]" />
                    <BudgetLine label={t('dashboard.remaining')} value={formatNPR(remainingBudget)} tone="bg-[#1f7a55]" />
                  </div>
                  <div className="mt-5 rounded-lg bg-white p-4 ring-1 ring-[var(--gov-border)] dark:bg-[#0f172a]">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-[var(--gov-text)]">{t('dashboard.spendingProgress')}</p>
                      <p className="text-sm font-semibold text-[var(--gov-primary)]">{budgetUsed}%</p>
                    </div>
                    <BudgetProgress percent={budgetUsed} />
                  </div>
                </>
              )}
            </div>

            <div className="rounded-lg border border-[var(--gov-border)] bg-[#fbfcfe] p-4 dark:bg-[#111827]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="gov-label uppercase">{t('dashboard.whereMoneyGoes')}</p>
                  <h3 className="gov-h3 mt-2">{t('dashboard.topDepartments')}</h3>
                </div>
                <WalletCards className="h-5 w-5 text-[var(--gov-primary)]" />
              </div>

              {loading ? <Skeleton className="mt-5 h-40" /> : !topDepartments.length ? <EmptyState text={t('dashboard.noData')} /> : (
                <div className="mt-5 space-y-4">
                  {topDepartments.map((dept) => (
                    <div key={dept.key}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-medium text-[var(--gov-text)]">{dept.key}</p>
                        <p className="shrink-0 text-sm font-medium text-[var(--gov-muted)]">{formatNPR(dept.value || 0)}</p>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e8eef5] dark:bg-[#1f2937]">
                        <div className="h-full rounded-full bg-[#365f8c]" style={{ width: `${Math.max(8, Math.round(((dept.value || 0) / maxDepartmentValue) * 100))}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="gov-card p-5 sm:p-6">
          <h2 className="gov-h2">{t('dashboard.recentActivity')}</h2>
          <div className="mt-5 space-y-1">
            {activity.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.id} className="flex gap-3 rounded-lg p-3 hover:bg-[#f8fafc] dark:hover:bg-[#111827]">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#eef5fb] text-[var(--gov-info)]"><Icon className="h-4 w-4" /></span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-5 text-[var(--gov-text)]">{item.title}</p>
                    <p className="gov-secondary mt-0.5">{item.meta}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="gov-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-[var(--gov-border)] px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div>
            <h2 className="gov-h2">{t('dashboard.reportsAttention')}</h2>
          </div>
          <Link href="/issues" className="text-sm font-medium text-[var(--gov-primary)] hover:underline">{t('dashboard.viewAllReports')}</Link>
        </div>

        {loading ? (
          <div className="space-y-3 p-5 sm:p-6">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
          </div>
        ) : !reports.length ? (
          <div className="px-6 py-14 text-center">
            <Landmark className="mx-auto h-10 w-10 text-[var(--gov-bluegray)]" />
            <h3 className="gov-h3 mt-3">{t('dashboard.noReports')}</h3>
            <p className="gov-secondary mx-auto mt-1 max-w-sm">{t('dashboard.noReportsSub')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left">
              <thead className="bg-[#f8fafc] dark:bg-[#111827]">
                <tr className="border-b border-[var(--gov-border)]">
                  {[t('dashboard.report'), t('dashboard.location'), t('dashboard.authority'), t('dashboard.priority'), t('dashboard.status'), t('dashboard.updated')].map((head) => (
                    <th key={head} className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-[var(--gov-muted)]">{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--gov-border)]">
                {reports.slice(0, 3).map((r) => (
                  <tr key={r._id} className="hover:bg-[#fbfcfe] dark:hover:bg-[#111827]">
                    <td className="px-5 py-4">
                      <Link href={`/issues/${r._id}`} className="text-sm font-medium text-[var(--gov-text)] hover:text-[var(--gov-primary)]">{r.title}</Link>
                      <p className="gov-secondary mt-1">{reportCode(r._id)}</p>
                    </td>
                    <td className="px-5 py-4 text-sm font-normal text-[var(--gov-muted)]">
                      <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-[var(--gov-subtle)]" />{[r.location?.municipality || r.location?.district, r.location?.ward ? `Ward ${r.location.ward}` : null].filter(Boolean).join(' · ') || t('dashboard.locationPending')}</span>
                    </td>
                    <td className="px-5 py-4 text-sm font-normal text-[var(--gov-muted)]">{r.assignedAuthority?.name || r.authority?.name || t('dashboard.notAssigned')}</td>
                    <td className="px-5 py-4"><span className={cn('gov-badge ring-1', PRIORITY_TONE[r.severity] || PRIORITY_TONE.low)}>{priorityText(r.severity)}</span></td>
                    <td className="px-5 py-4"><span className={cn('gov-badge ring-1', STATUS_TONE[r.status] || STATUS_TONE.pending)}>{statusText(r.status)}</span></td>
                    <td className="px-5 py-4 text-sm font-normal text-[var(--gov-muted)]">{dateLabel(r.updatedAt || r.createdAt, t)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function MyWardBudgetCard({ t, ward, municipality, district, loading, budget, detailsHref }) {
  if (!ward) {
    return (
      <section className="gov-card flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#fff4f3] text-[var(--gov-primary)]"><MapPinned className="h-4 w-4" /></span>
          <div>
            <p className="text-sm font-semibold text-[var(--gov-text)]">{t('dashboard.noWardSet')}</p>
            <p className="gov-secondary">{t('dashboard.noWardSetSub')}</p>
          </div>
        </div>
        <Link href="/settings" className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[var(--gov-primary)] px-3 text-xs font-medium text-white transition hover:bg-[var(--gov-primary-dark)]">
          {t('dashboard.goToSettings')} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </section>
    );
  }

  const totalBudget = budget?.total || 0;
  const spentBudget = budget?.spent || 0;
  const remainingBudget = budget?.remaining || 0;
  const progress = budget?.progress || 0;
  const wardNumber = String(ward).replace(/^Ward\s+/i, '').trim();
  const locationLine = [municipality, district].filter(Boolean).join(' · ');
  const hasData = budget && budget.count > 0;

  return (
    <section className="gov-card flex flex-wrap items-center gap-4 border border-[var(--gov-primary)]/20 p-4">
      <div className="flex shrink-0 items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#fff4f3] text-[var(--gov-primary)]"><Landmark className="h-4 w-4" /></span>
        <div>
          <p className="text-sm font-semibold text-[var(--gov-text)]">{t('dashboard.myWardBudget')} · Ward {wardNumber}</p>
          <p className="gov-secondary">{locationLine || t('dashboard.myWardBudgetSub')}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-1 flex-wrap gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-9 w-24" />)}
        </div>
      ) : !hasData ? (
        <p className="gov-secondary flex-1">{t('dashboard.noWardBudget')}</p>
      ) : (
        <div className="flex min-w-[220px] flex-1 flex-wrap items-center gap-x-6 gap-y-2">
          <InlineStat label={t('dashboard.allocated')} value={formatNPR(totalBudget)} />
          <InlineStat label={t('dashboard.spent')} value={formatNPR(spentBudget)} />
          <InlineStat label={t('dashboard.remaining')} value={formatNPR(remainingBudget)} />
          <InlineStat label={t('dashboard.progress')} value={`${progress}%`} />
          <div className="h-1.5 min-w-[100px] flex-1 overflow-hidden rounded-full bg-[#edf2f7] dark:bg-[#1f2937]">
            <div className="h-full rounded-full bg-[var(--gov-primary)] transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <Link href={detailsHref} className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[var(--gov-primary)] px-3 text-xs font-medium text-white transition hover:bg-[var(--gov-primary-dark)]">
        {t('dashboard.viewDetails')} <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </section>
  );
}

function InlineStat({ label, value }) {
  return (
    <div>
      <p className="gov-label uppercase leading-tight">{label}</p>
      <p className="text-sm font-semibold leading-tight text-[var(--gov-text)]">{value}</p>
    </div>
  );
}

function HeroMapPreview({ reports, loading, t }) {
  const visibleReports = reports.slice(0, 3);
  const pinPositions = [
    { left: '56%', top: '39%' },
    { left: '43%', top: '51%' },
    { left: '70%', top: '55%' },
  ];

  return (
    <div className="mt-6 rounded-xl border border-[var(--gov-border)] bg-[#f7fafc] p-4 dark:bg-[#111827]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
        <div className="relative min-h-[210px] flex-1 overflow-hidden rounded-lg border border-[#dce5ee] bg-[#e8eef5] dark:border-[#253044] dark:bg-[#0f172a]">
          <img
            src="/nepal-relief-map.jpg"
            alt={t('dashboard.nepalMap') || 'Nepal map'}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-white/25 via-transparent to-white/10 dark:from-[#0f172a]/45 dark:to-[#0f172a]/10" />
          {pinPositions.map((pos, index) => (
            <span
              key={index}
              className="absolute grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-[var(--gov-primary)] shadow-lg ring-1 ring-[#f4bbb8]"
              style={pos}
            >
              <MapPin className="h-5 w-5" />
            </span>
          ))}
          <div className="absolute bottom-3 left-3 rounded-lg bg-white/92 px-3 py-2 shadow-sm ring-1 ring-[var(--gov-border)] dark:bg-[#0f172a]/92">
            <p className="text-xs font-medium text-[var(--gov-text)]">{t('dashboard.mapPreview')}</p>
            <p className="text-[11px] text-[var(--gov-muted)]">{t('dashboard.mapPreviewSub')}</p>
          </div>
        </div>

        <div className="w-full rounded-lg bg-white p-4 ring-1 ring-[var(--gov-border)] dark:bg-[#0f172a] lg:w-[260px]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="gov-h3 mt-1">{t('dashboard.mapAreas')}</h2>
            </div>
            <MapPin className="h-5 w-5 text-[var(--gov-primary)]" />
          </div>
          {loading ? (
            <div className="mt-4 space-y-2">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : !visibleReports.length ? (
            <p className="gov-secondary mt-4">{t('dashboard.mapNoReports')}</p>
          ) : (
            <div className="mt-4 space-y-3">
              {visibleReports.map((report) => (
                <Link key={report._id} href={`/issues/${report._id}`} className="block rounded-lg border border-[var(--gov-border)] p-3 transition hover:bg-[#f8fafc] dark:hover:bg-[#111827]">
                  <p className="truncate text-sm font-medium text-[var(--gov-text)]">{report.title}</p>
                  <p className="mt-1 truncate text-xs text-[var(--gov-muted)]">
                    {[report.location?.municipality || report.location?.district, report.location?.ward ? `Ward ${report.location.ward}` : null].filter(Boolean).join(' · ') || t('dashboard.locationPending')}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
function BudgetMini({ label, value }) {
  return (
    <div className="rounded-lg border border-[var(--gov-border)] bg-[#fbfcfe] p-3 dark:bg-[#111827]">
      <p className="gov-secondary">{label}</p>
      <p className="mt-1 text-sm font-medium text-[var(--gov-text)]">{value}</p>
    </div>
  );
}

function BudgetLine({ label, value, tone }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-white p-3 ring-1 ring-[var(--gov-border)] dark:bg-[#0f172a]">
      <div className="flex min-w-0 items-center gap-3">
        <span className={cn('h-3 w-3 shrink-0 rounded-full', tone)} />
        <p className="truncate text-sm font-medium text-[var(--gov-text)]">{label}</p>
      </div>
      <p className="shrink-0 text-sm font-semibold text-[var(--gov-text)]">{value}</p>
    </div>
  );
}

function BudgetProgress({ percent }) {
  return (
    <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-[#edf2f7] dark:bg-[#1f2937]">
      <div className="h-full rounded-full bg-[var(--gov-primary)] transition-all" style={{ width: `${percent}%` }} />
    </div>
  );
}

function EmptyState({ text }) {
  return <div className="mt-5 rounded-lg border border-dashed border-[var(--gov-border)] bg-white px-4 py-10 text-center text-sm text-[var(--gov-subtle)] dark:bg-[#0f172a]">{text}</div>;
}

function Skeleton({ className }) {
  return <div className={cn('shimmer rounded-lg bg-[#edf2f7] dark:bg-[#1f2937]', className)} />;
}