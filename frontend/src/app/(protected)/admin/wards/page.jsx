'use client';
import { useEffect, useMemo, useState } from 'react';
import { get, patch, post } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { Check, MapPinned, Plus, ShieldCheck, X } from 'lucide-react';
import Pagination from '@/components/Pagination';

const emptyWard = { province: '', district: '', municipality: '', ward: '', representative: '' };

export default function WardAdminPage() {
  const { user } = useAuth();
  const [wards, setWards] = useState([]);
  const [applications, setApplications] = useState([]);
  const [form, setForm] = useState(emptyWard);
  const [loading, setLoading] = useState(true);
  const [appPage, setAppPage] = useState(1);
  const [appLimit, setAppLimit] = useState(10);
  const [wardPage, setWardPage] = useState(1);
  const [wardLimit, setWardLimit] = useState(10);

  const reps = useMemo(() => applications.filter(a => a.role === 'ward_rep' && a.status === 'active'), [applications]);
  const appPages = Math.max(1, Math.ceil(applications.length / appLimit));
  const safeAppPage = Math.min(appPage, appPages);
  const pagedApplications = applications.slice((safeAppPage - 1) * appLimit, safeAppPage * appLimit);
  const wardPages = Math.max(1, Math.ceil(wards.length / wardLimit));
  const safeWardPage = Math.min(wardPage, wardPages);
  const pagedWards = wards.slice((safeWardPage - 1) * wardLimit, safeWardPage * wardLimit);

  useEffect(() => { setAppPage(1); }, [appLimit, applications.length]);
  useEffect(() => { setWardPage(1); }, [wardLimit, wards.length]);

  const load = () => Promise.all([get('/api/wards'), get('/api/wards/representatives/applications')])
    .then(([w, a]) => { setWards(w.wards || []); setApplications(a.applications || []); setLoading(false); })
    .catch(e => { toast.error(e.message); setLoading(false); });
  useEffect(() => { if (user?.role === 'admin') load(); }, [user?.role]);

  const saveWard = async (e) => {
    e.preventDefault();
    try { await post('/api/wards', form); toast.success('Ward saved'); setForm(emptyWard); load(); }
    catch (err) { toast.error(err.message); }
  };
  const review = async (id, wardRepresentativeStatus) => {
    try { await patch(`/api/users/${id}`, { wardRepresentativeStatus }); toast.success(wardRepresentativeStatus === 'approved' ? 'Ward representative approved' : 'Applicant rejected and banned'); load(); }
    catch (err) { toast.error(err.message); }
  };

  if (user?.role !== 'admin') return <div className="text-sm text-[var(--gov-muted)]">Admin only.</div>;

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <div>
        <p className="gov-label uppercase">Administration</p>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--gov-text)]">Ward offices</h1>
        <p className="mt-1 text-sm text-[var(--gov-muted)]">Create wards, assign representatives, and review pending ward representative requests.</p>
      </div>

      <form onSubmit={saveWard} className="rounded-xl border border-[var(--gov-border)] bg-white p-4 shadow-sm sm:p-5">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-[var(--gov-text)]"><Plus className="h-4 w-4 text-[var(--gov-primary)]" />Create or update ward</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <input required value={form.province} onChange={e => setForm(f => ({ ...f, province: e.target.value }))} placeholder="Province" className="h-10 rounded-lg border border-[var(--gov-border)] px-3 text-sm outline-none focus:border-[var(--gov-primary)]" />
          <input required value={form.district} onChange={e => setForm(f => ({ ...f, district: e.target.value }))} placeholder="District" className="h-10 rounded-lg border border-[var(--gov-border)] px-3 text-sm outline-none focus:border-[var(--gov-primary)]" />
          <input value={form.municipality} onChange={e => setForm(f => ({ ...f, municipality: e.target.value }))} placeholder="Municipality" className="h-10 rounded-lg border border-[var(--gov-border)] px-3 text-sm outline-none focus:border-[var(--gov-primary)]" />
          <input required value={form.ward} onChange={e => setForm(f => ({ ...f, ward: e.target.value }))} placeholder="Ward" className="h-10 rounded-lg border border-[var(--gov-border)] px-3 text-sm outline-none focus:border-[var(--gov-primary)]" />
          <select value={form.representative} onChange={e => setForm(f => ({ ...f, representative: e.target.value }))} className="h-10 rounded-lg border border-[var(--gov-border)] px-3 text-sm outline-none focus:border-[var(--gov-primary)]">
            <option value="">No representative</option>
            {reps.map(r => <option key={r._id} value={r._id}>{r.name} - {r.email}</option>)}
          </select>
        </div>
        <button className="mt-3 h-10 rounded-lg bg-[var(--gov-primary)] px-4 text-sm font-semibold text-white">Save ward</button>
      </form>

      <section className="rounded-xl border border-[var(--gov-border)] bg-white shadow-sm">
        <div className="border-b border-[var(--gov-border)] px-5 py-3"><h2 className="text-base font-semibold text-[var(--gov-text)]">Ward representative applications</h2></div>
        <div className="divide-y divide-[var(--gov-border)]">
          {loading ? <p className="p-5 text-sm text-[var(--gov-muted)]">Loading...</p> : applications.length === 0 ? <p className="p-5 text-sm text-[var(--gov-muted)]">No applications yet.</p> : pagedApplications.map(a => (
            <div key={a._id} className="grid gap-3 p-4 lg:grid-cols-[1fr_auto] lg:p-5">
              <div className="min-w-0">
                <p className="font-semibold text-[var(--gov-text)]">{a.name} <span className="text-xs font-normal text-[var(--gov-muted)]">{a.email}</span></p>
                <p className="mt-1 text-sm text-[var(--gov-muted)]">{a.wardRepresentativeApplication?.province} / {a.wardRepresentativeApplication?.district} / {a.wardRepresentativeApplication?.municipality || 'Municipality not set'} / Ward {a.wardRepresentativeApplication?.ward}</p>
                <p className="mt-2 rounded-lg bg-[var(--gov-surface-soft)] p-3 text-sm text-[var(--gov-muted)]">{a.wardRepresentativeApplication?.details || 'No application detail.'}</p>
                <span className="mt-2 inline-flex rounded-md bg-amber-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700">{a.wardRepresentativeApplication?.status || 'pending'}</span>
              </div>
              {a.wardRepresentativeApplication?.status === 'pending' && <div className="flex flex-wrap items-start gap-2"><button onClick={() => review(a._id, 'approved')} className="inline-flex h-9 items-center gap-1 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white"><Check className="h-3.5 w-3.5" />Approve</button><button onClick={() => review(a._id, 'rejected')} className="inline-flex h-9 items-center gap-1 rounded-lg bg-red-600 px-3 text-xs font-semibold text-white"><X className="h-3.5 w-3.5" />Reject + Ban</button></div>}
            </div>
          ))}
        </div>
        <div className="border-t border-[var(--gov-border)] p-3"><Pagination page={safeAppPage} limit={appLimit} total={applications.length} onPageChange={setAppPage} onLimitChange={setAppLimit} label="applications" /></div>
      </section>

      <section className="rounded-xl border border-[var(--gov-border)] bg-white shadow-sm">
        <div className="border-b border-[var(--gov-border)] px-5 py-3"><h2 className="flex items-center gap-2 text-base font-semibold text-[var(--gov-text)]"><MapPinned className="h-4 w-4 text-[var(--gov-primary)]" />Managed wards</h2></div>
        <div className="hidden overflow-x-auto md:block"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs uppercase text-[var(--gov-muted)]"><th className="px-5 py-3">Province</th><th className="px-5 py-3">District</th><th className="px-5 py-3">Municipality</th><th className="px-5 py-3">Ward</th><th className="px-5 py-3">Representative</th></tr></thead><tbody className="divide-y divide-[var(--gov-border)]">{pagedWards.map(w => <tr key={w._id}><td className="px-5 py-3">{w.province}</td><td className="px-5 py-3">{w.district}</td><td className="px-5 py-3">{w.municipality || '-'}</td><td className="px-5 py-3">{w.ward}</td><td className="px-5 py-3">{w.representative?.name || 'Unassigned'}</td></tr>)}</tbody></table></div>
        <div className="grid gap-3 p-3 md:hidden">{pagedWards.map(w => <div key={w._id} className="rounded-lg border border-[var(--gov-border)] p-3"><p className="font-semibold text-[var(--gov-text)]">Ward {w.ward}, {w.municipality || w.district}</p><p className="mt-1 text-sm text-[var(--gov-muted)]">{w.province} / {w.district}</p><p className="mt-2 text-sm">Representative: <span className="font-medium">{w.representative?.name || 'Unassigned'}</span></p></div>)}</div>
        <div className="border-t border-[var(--gov-border)] p-3"><Pagination page={safeWardPage} limit={wardLimit} total={wards.length} onPageChange={setWardPage} onLimitChange={setWardLimit} label="wards" /></div>
      </section>
    </div>
  );
}
