'use client';
import { useEffect, useMemo, useState } from 'react';
import { get, post } from '@/lib/api';
import { toast } from 'sonner';
import { Building2, Loader2, Plus, Search } from 'lucide-react';
import Pagination from '@/components/Pagination';

const empty = { name: '', email: '', password: '', province: '', district: '', municipality: '', municipalityType: 'municipality', officePhone: '', officeAddress: '' };

export default function MunicipalityHeadsPage() {
  const [heads, setHeads] = useState([]);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const load = () => get('/api/municipality-heads').then(d => setHeads(d.heads || [])).catch(() => {});
  useEffect(() => { load(); }, []);
  const filteredHeads = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return heads;
    return heads.filter(h => [h.name, h.email, h.status, h.municipalityHeadProfile?.district, h.municipalityHeadProfile?.municipality].filter(Boolean).join(' ').toLowerCase().includes(q));
  }, [heads, query]);
  useEffect(() => { setPage(1); }, [query, limit, heads.length]);
  const totalPages = Math.max(1, Math.ceil(filteredHeads.length / limit));
  const safePage = Math.min(page, totalPages);
  const pagedHeads = filteredHeads.slice((safePage - 1) * limit, safePage * limit);

  const submit = async (e) => {
    e.preventDefault(); setSaving(true);
    try { await post('/api/municipality-heads', form); toast.success('Municipality head created'); setForm(empty); load(); }
    catch (err) { toast.error(err.message); }
    setSaving(false);
  };
  return <div className="mx-auto max-w-[1200px] space-y-5">
    <div><p className="gov-label uppercase">Administration</p><h1 className="mt-1 text-2xl font-semibold text-[var(--gov-text)]">Municipality heads</h1><p className="mt-1 text-sm text-[var(--gov-muted)]">Create official municipality access. Each head sees only their assigned municipality.</p></div>
    <div className="grid gap-5 lg:grid-cols-[420px_1fr]">
      <form onSubmit={submit} className="space-y-3 rounded-xl border border-[var(--gov-border)] bg-white p-4 shadow-sm sm:p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--gov-text)]"><Building2 className="h-4 w-4 text-[var(--gov-primary)]" />Add municipality head</h2>
        {['name','email','password','province','district','municipality','officePhone','officeAddress'].map(k => <input key={k} type={k === 'password' ? 'password' : 'text'} value={form[k]} onChange={e => set(k, e.target.value)} placeholder={k.replace(/([A-Z])/g, ' $1')} className="h-10 w-full rounded-lg border border-[var(--gov-border)] px-3 text-sm outline-none focus:border-[var(--gov-primary)]" />)}
        <select value={form.municipalityType} onChange={e => set('municipalityType', e.target.value)} className="h-10 w-full rounded-lg border border-[var(--gov-border)] px-3 text-sm"><option value="municipality">Municipality</option><option value="rural_municipality">Rural municipality</option><option value="metropolitan">Metropolitan</option><option value="sub_metropolitan">Sub-metropolitan</option></select>
        <button disabled={saving} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[var(--gov-primary)] text-sm font-semibold text-white disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Create account</button>
      </form>
      <section className="overflow-hidden rounded-xl border border-[var(--gov-border)] bg-white shadow-sm">
        <div className="border-b border-[var(--gov-border)] p-3">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--gov-subtle)]" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search municipality heads..." className="h-10 w-full rounded-lg border border-[var(--gov-border)] pl-9 pr-3 text-sm outline-none focus:border-[var(--gov-primary)]" />
          </label>
        </div>
        <div className="hidden overflow-x-auto md:block"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs uppercase text-[var(--gov-muted)]"><th className="p-3">Name</th><th className="p-3">Municipality</th><th className="p-3">Status</th></tr></thead><tbody className="divide-y divide-[var(--gov-border)]">{pagedHeads.map(h => <tr key={h._id}><td className="p-3"><p className="font-medium text-[var(--gov-text)]">{h.name}</p><p className="text-xs text-[var(--gov-muted)]">{h.email}</p></td><td className="p-3 text-[var(--gov-muted)]">{h.municipalityHeadProfile?.district}, {h.municipalityHeadProfile?.municipality}</td><td className="p-3 capitalize">{h.status}</td></tr>)}</tbody></table></div>
        <div className="grid gap-3 p-3 md:hidden">{pagedHeads.map(h => <div key={h._id} className="rounded-lg border border-[var(--gov-border)] p-3"><p className="font-semibold text-[var(--gov-text)]">{h.name}</p><p className="text-xs text-[var(--gov-muted)]">{h.email}</p><p className="mt-2 text-sm text-[var(--gov-muted)]">{h.municipalityHeadProfile?.district}, {h.municipalityHeadProfile?.municipality}</p><span className="mt-2 inline-flex rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-semibold uppercase text-emerald-700">{h.status}</span></div>)}</div>
        <div className="border-t border-[var(--gov-border)] p-3"><Pagination page={safePage} limit={limit} total={filteredHeads.length} onPageChange={setPage} onLimitChange={setLimit} label="municipality heads" /></div>
      </section>
    </div>
  </div>;
}
