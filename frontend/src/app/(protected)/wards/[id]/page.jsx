'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { get } from '@/lib/api';
import { formatNPR, cn, relativeTime } from '@/lib/format';
import { ArrowLeft, MapPin, Building2, Table2, AlertTriangle, FileText, Megaphone, User } from 'lucide-react';

const STATUS_COLOR = {
  planned: 'bg-slate-100 text-slate-700', ongoing: 'bg-blue-50 text-blue-700',
  completed: 'bg-emerald-50 text-emerald-700', delayed: 'bg-red-50 text-red-700',
};
const ISSUE_STATUS_COLOR = {
  pending: 'bg-amber-50 text-amber-700', verified: 'bg-blue-50 text-blue-700',
  assigned: 'bg-violet-50 text-violet-700', 'in-progress': 'bg-cyan-50 text-cyan-700',
  completed: 'bg-emerald-50 text-emerald-700', closed: 'bg-teal-50 text-teal-700',
  rejected: 'bg-gray-100 text-gray-500', duplicate: 'bg-gray-100 text-gray-500',
};
const NOTICE_COLOR = { normal: 'bg-gray-50 text-gray-700 border-gray-200', important: 'bg-amber-50 text-amber-700 border-amber-200', urgent: 'bg-red-50 text-red-700 border-red-200' };

export default function WardTransparencyPage() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    get(`/api/wards/${id}/transparency`).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="max-w-[1100px] mx-auto space-y-4"><div className="shimmer h-8 w-40 rounded-lg" /><div className="shimmer h-64 rounded-2xl" /></div>;
  if (!data) return <div className="max-w-[1100px] mx-auto text-center py-16 text-gray-400">Ward not found.</div>;

  const { ward, projects, budget, issues, documents, notices } = data;

  return (
    <div className="mx-auto max-w-[1100px] space-y-5">
      <button onClick={() => router.push('/wards')} className="flex items-center gap-1.5 text-sm text-[#65706c] hover:text-[#102a2b]"><ArrowLeft className="w-4 h-4" />Back to Wards</button>

      <div className="rounded-lg border border-[#ded6c8] bg-white p-6 shadow-sm">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#dc143c]">Ward Transparency</p>
        <h1 className="mt-1 text-2xl font-black text-[#102a2b] flex items-center gap-2"><MapPin className="h-5 w-5 text-[#dc143c]" />Ward {ward.ward}</h1>
        <p className="mt-1 text-sm text-[#65706c]">{ward.municipality}{ward.municipality && ward.district ? ', ' : ''}{ward.district}, {ward.province}</p>
        {ward.representativeName && <p className="mt-2 text-xs text-[#8c8272] flex items-center gap-1"><User className="h-3.5 w-3.5" />Ward Representative: {ward.representativeName}</p>}
      </div>

      {notices?.length > 0 && (
        <div className="space-y-2">
          {notices.slice(0, 3).map(n => (
            <div key={n._id} className={cn('rounded-lg border px-4 py-3 flex items-start gap-2', NOTICE_COLOR[n.priority])}>
              <Megaphone className="h-4 w-4 mt-0.5 shrink-0" />
              <div><p className="text-sm font-black">{n.title}</p><p className="text-xs mt-0.5">{n.message}</p></div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Metric label="Total Allocated" value={formatNPR(budget.summary.allocated)} />
        <Metric label="Spent" value={formatNPR(budget.summary.spent)} />
        <Metric label="Remaining" value={formatNPR(budget.summary.remaining)} />
      </div>

      <Section title="Projects" icon={Building2} empty="No projects recorded for this ward yet.">
        {projects.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {projects.map(p => (
              <div key={p._id} className="rounded-lg border border-[#ded6c8] bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-black text-[#102a2b]">{p.name}</p>
                  <span className={cn('rounded-md px-2 py-0.5 text-[10px] font-black uppercase', STATUS_COLOR[p.status] || STATUS_COLOR.planned)}>{p.status}</span>
                </div>
                <p className="text-xs text-[#8c8272] mt-1">{p.sector} - FY {p.fiscalYear}</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div><p className="text-[#8c8272]">Approved</p><p className="font-black text-[#0f6e56]">{formatNPR(p.budget)}</p></div>
                  <div><p className="text-[#8c8272]">Revised</p><p className="font-black text-[#0f6e56]">{p.revisedBudget != null ? formatNPR(p.revisedBudget) : 'Not revised'}</p></div>
                  <div><p className="text-[#8c8272]">Spent</p><p className="font-black text-[#102a2b]">{formatNPR(p.spent)}</p></div>
                  <div><p className="text-[#8c8272]">Progress</p><p className="font-black text-[#102a2b]">{p.completionOverride ?? '-'}%</p></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Budget Line Items" icon={Table2} empty="No budget records for this ward yet.">
        {budget.items.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-[#ded6c8] bg-white">
            <table className="w-full text-sm">
              <thead><tr className="border-b-2 border-[#102a2b] text-left text-[11px] text-[#8c8272]"><th className="px-4 py-3">Title</th><th className="px-4 py-3">Department</th><th className="px-4 py-3 text-right">Allocated</th><th className="px-4 py-3 text-right">Spent</th><th className="px-4 py-3">Status</th></tr></thead>
              <tbody className="divide-y divide-[#f2ede4]">
                {budget.items.map(b => (
                  <tr key={b._id}>
                    <td className="px-4 py-3 font-medium text-[#102a2b]">{b.title}</td>
                    <td className="px-4 py-3 text-xs text-[#8c8272]">{b.department}</td>
                    <td className="px-4 py-3 text-right text-[#0f6e56] font-medium">{formatNPR(b.amount)}</td>
                    <td className="px-4 py-3 text-right text-[#102a2b]">{formatNPR(b.spent)}</td>
                    <td className="px-4 py-3"><span className={cn('rounded-md px-2 py-0.5 text-[10px] font-black uppercase', STATUS_COLOR[b.status] || STATUS_COLOR.planned)}>{b.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Civic Issues" icon={AlertTriangle} empty="No civic issues reported in this ward yet.">
        {issues.length > 0 && (
          <div className="space-y-2">
            {issues.map(i => (
              <div key={i._id} className="flex items-center justify-between rounded-lg border border-[#ded6c8] bg-white px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-[#102a2b]">{i.title}</p>
                  <p className="text-xs text-[#8c8272] mt-0.5">{i.category} - {relativeTime(i.createdAt)}{i.supportCount ? ` - ${i.supportCount} citizen(s) supported` : ''}</p>
                </div>
                <span className={cn('rounded-md px-2 py-0.5 text-[10px] font-black uppercase shrink-0 ml-3', ISSUE_STATUS_COLOR[i.status] || ISSUE_STATUS_COLOR.pending)}>{i.status.replace('-', ' ')}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Public Documents" icon={FileText} empty="No public documents uploaded for this area yet.">
        {documents.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {documents.map(d => (
              <div key={d._id} className="rounded-lg border border-[#ded6c8] bg-white p-4">
                <p className="text-sm font-black text-[#102a2b]">{d.title}</p>
                <p className="text-xs text-[#8c8272] mt-1 capitalize">{d.docType.replace('-', ' ')} - FY {d.fiscalYear}</p>
                {d.summary && <p className="text-xs text-[#65706c] mt-2 line-clamp-3">{d.summary}</p>}
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function Metric({ label, value }) {
  return <div className="rounded-lg border border-[#ded6c8] bg-white p-2.5 shadow-sm sm:p-4"><p className="truncate text-[10px] text-[#8c8272] sm:text-[11px]">{label}</p><p className="mt-1 truncate text-sm font-black tabular-nums text-[#0f6e56] sm:text-[22px]">{value}</p></div>;
}

function Section({ title, icon: Icon, empty, children }) {
  const hasContent = Boolean(children);
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-black text-[#102a2b] flex items-center gap-2"><Icon className="h-4 w-4 text-[#dc143c]" />{title}</h2>
      {hasContent ? children : (
        <div className="rounded-lg border border-[#ded6c8] bg-white p-8 text-center text-sm text-[#8c8272]">{empty}</div>
      )}
    </div>
  );
}