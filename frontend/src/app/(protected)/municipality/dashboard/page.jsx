'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { get } from '@/lib/api';
import { formatNPR } from '@/lib/format';
import { Building2, ClipboardList, Table2, Users } from 'lucide-react';

export default function MunicipalityDashboardPage() {
  const [data, setData] = useState(null);
  useEffect(() => { get('/api/municipality/dashboard').then(setData).catch(() => setData(null)); }, []);
  const s = data?.summary || {};
  return <div className="mx-auto max-w-[1300px] space-y-5">
    <div><p className="gov-label uppercase">Municipality workspace</p><h1 className="mt-1 text-2xl font-semibold text-[var(--gov-text)]">{data?.profile?.municipality || 'Municipality'} dashboard</h1><p className="mt-1 text-sm text-[var(--gov-muted)]">Scoped view of ward issues, public budget, projects, and representatives.</p></div>
    <div className="grid gap-4 md:grid-cols-4"><Metric icon={ClipboardList} label="Active issues" value={s.activeReports || 0} /><Metric icon={Users} label="Verified citizens" value={s.citizens || 0} /><Metric icon={Building2} label="Ward reps" value={s.wardRepresentatives || 0} /><Metric icon={Table2} label="Budget tracked" value={formatNPR(s.allocated || 0)} /></div>
    <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
      <section className="rounded-xl border border-[var(--gov-border)] bg-white shadow-sm"><div className="border-b p-4"><h2 className="text-base font-semibold">Priority issues</h2></div><div className="divide-y">{(data?.reports || []).slice(0, 8).map(r => <Link href={`/issues/${r._id}`} key={r._id} className="block p-4 hover:bg-[#f8fafc]"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{r.title}</p><p className="mt-1 text-sm text-[var(--gov-muted)]">Ward {r.location?.ward || '-'} · {r.status}</p></div><span className="rounded-md bg-[#fff4f3] px-2 py-1 text-xs font-semibold text-[var(--gov-primary)]">{r.priorityLevel || r.severity}</span></div></Link>)}</div></section>
      <aside className="rounded-xl border border-[var(--gov-border)] bg-white p-5 shadow-sm"><h2 className="text-base font-semibold">Ward summary</h2><div className="mt-4 space-y-3">{(data?.wards || []).map(w => <div key={w.ward} className="rounded-lg border border-[var(--gov-border)] p-3"><div className="flex justify-between text-sm"><span>Ward {w.ward}</span><strong>{w.reports} reports</strong></div><p className="mt-1 text-xs text-[var(--gov-muted)]">{w.urgent} urgent items</p></div>)}</div></aside>
    </div>
  </div>;
}
function Metric({ icon: Icon, label, value }) { return <div className="rounded-xl border border-[var(--gov-border)] bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><p className="text-sm text-[var(--gov-muted)]">{label}</p><Icon className="h-4 w-4 text-[var(--gov-primary)]" /></div><p className="mt-3 text-2xl font-semibold text-[var(--gov-text)]">{value}</p></div>; }
