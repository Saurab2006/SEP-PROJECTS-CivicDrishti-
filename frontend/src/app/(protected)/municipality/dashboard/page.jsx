'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { get, post } from '@/lib/api';
import { formatNPR } from '@/lib/format';
import { toast } from 'sonner';
import { Building2, ClipboardList, Loader2, Plus, Table2, UserPlus, Users } from 'lucide-react';

const emptyRep = { name: '', email: '', password: '', ward: '', details: '' };

export default function MunicipalityDashboardPage() {
  const [data, setData] = useState(null);
  const [reps, setReps] = useState([]);
  const [repsLoading, setRepsLoading] = useState(true);
  const [form, setForm] = useState(emptyRep);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const load = () => get('/api/municipality/dashboard').then(setData).catch(() => setData(null));
  const loadReps = () => get('/api/municipality/ward-representatives').then(d => setReps(d.representatives || [])).catch(() => setReps([])).finally(() => setRepsLoading(false));
  useEffect(() => { load(); loadReps(); }, []);

  const submit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await post('/api/municipality/ward-representatives', form);
      toast.success('Ward representative added');
      setForm(emptyRep);
      loadReps();
      load();
    } catch (err) { toast.error(err.message); }
    setSaving(false);
  };

  const s = data?.summary || {};
  return <div className="mx-auto max-w-[1300px] space-y-5">
    <div><p className="gov-label uppercase">Municipality workspace</p><h1 className="mt-1 text-2xl font-semibold text-[var(--gov-text)]">{data?.profile?.municipality || 'Municipality'} dashboard</h1></div>
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4"><Metric icon={ClipboardList} label="Active issues" value={s.activeReports || 0} /><Metric icon={Users} label="Verified citizens" value={s.citizens || 0} /><Metric icon={Building2} label="Ward reps" value={s.wardRepresentatives || 0} /><Metric icon={Table2} label="Budget tracked" value={formatNPR(s.allocated || 0)} /></div>
    <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
      <section className="rounded-xl border border-[var(--gov-border)] bg-white shadow-sm"><div className="border-b p-4"><h2 className="text-base font-semibold">Priority issues</h2></div><div className="divide-y">{(data?.reports || []).slice(0, 8).map(r => <Link href={`/issues/${r._id}`} key={r._id} className="block p-4 hover:bg-[#f8fafc]"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{r.title}</p><p className="mt-1 text-sm text-[var(--gov-muted)]">Ward {r.location?.ward || '-'} · {r.status}</p></div><span className="rounded-md bg-[#fff4f3] px-2 py-1 text-xs font-semibold text-[var(--gov-primary)]">{r.priorityLevel || r.severity}</span></div></Link>)}</div></section>
      <aside className="rounded-xl border border-[var(--gov-border)] bg-white p-5 shadow-sm"><h2 className="text-base font-semibold">Ward summary</h2><div className="mt-4 space-y-3">{(data?.wards || []).map(w => <div key={w.ward} className="rounded-lg border border-[var(--gov-border)] p-3"><div className="flex justify-between text-sm"><span>Ward {w.ward}</span><strong>{w.reports} reports</strong></div><p className="mt-1 text-xs text-[var(--gov-muted)]">{w.urgent} urgent items</p></div>)}</div></aside>
    </div>

    <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
      <form onSubmit={submit} className="space-y-3 rounded-xl border border-[var(--gov-border)] bg-white p-4 shadow-sm sm:p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--gov-text)]"><UserPlus className="h-4 w-4 text-[var(--gov-primary)]" />Add ward representative</h2>
        <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Name" className="h-10 w-full rounded-lg border border-[var(--gov-border)] px-3 text-sm outline-none focus:border-[var(--gov-primary)]" />
        <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="Email" className="h-10 w-full rounded-lg border border-[var(--gov-border)] px-3 text-sm outline-none focus:border-[var(--gov-primary)]" />
        <input type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="Password" className="h-10 w-full rounded-lg border border-[var(--gov-border)] px-3 text-sm outline-none focus:border-[var(--gov-primary)]" />
        <input value={form.ward} onChange={e => set('ward', e.target.value)} placeholder="Ward number" className="h-10 w-full rounded-lg border border-[var(--gov-border)] px-3 text-sm outline-none focus:border-[var(--gov-primary)]" />
        <textarea value={form.details} onChange={e => set('details', e.target.value)} placeholder="Notes (optional)" rows={2} className="w-full rounded-lg border border-[var(--gov-border)] px-3 py-2 text-sm outline-none focus:border-[var(--gov-primary)]" />
        <button disabled={saving} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[var(--gov-primary)] text-sm font-semibold text-white disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Add representative</button>
      </form>

      <section className="overflow-hidden rounded-xl border border-[var(--gov-border)] bg-white shadow-sm">
        <div className="border-b border-[var(--gov-border)] px-5 py-3"><h2 className="text-base font-semibold text-[var(--gov-text)]">Ward representatives</h2></div>
        <div className="divide-y divide-[var(--gov-border)]">
          {repsLoading ? <p className="p-5 text-sm text-[var(--gov-muted)]">Loading...</p> : reps.length === 0 ? <p className="p-5 text-sm text-[var(--gov-muted)]">No ward representatives added yet.</p> : reps.map(r => (
            <div key={r._id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-medium text-[var(--gov-text)]">{r.name} <span className="text-xs font-normal text-[var(--gov-muted)]">{r.email}</span></p>
                <p className="mt-1 text-sm text-[var(--gov-muted)]">Ward {r.wardRepresentativeApplication?.ward}</p>
              </div>
              <span className="shrink-0 rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-semibold uppercase text-emerald-700">{r.status}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  </div>;
}
function Metric({ icon: Icon, label, value }) { return <div className="min-w-0 rounded-xl border border-[var(--gov-border)] bg-white p-3 shadow-sm sm:p-4"><div className="flex items-center justify-between gap-2"><p className="truncate text-xs text-[var(--gov-muted)] sm:text-sm">{label}</p><Icon className="h-3.5 w-3.5 shrink-0 text-[var(--gov-primary)] sm:h-4 sm:w-4" /></div><p className="mt-2 truncate text-lg font-semibold text-[var(--gov-text)] sm:mt-3 sm:text-2xl">{value}</p></div>; }