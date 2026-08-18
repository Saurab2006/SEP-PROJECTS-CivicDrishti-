'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { get, post } from '@/lib/api';
import { relativeTime, cn } from '@/lib/format';
import { toast } from 'sonner';
import {
  AlertTriangle, MapPin, Plus, ArrowRight, Clock, Copy, ShieldAlert,
  Loader2, X, ImagePlus, ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import MapPicker from '@/components/MapPicker';
import IssuesMap from '@/components/IssuesMap';
import Pagination from '@/components/Pagination';

const STATUS_STYLE = {
  pending: 'bg-amber-50 text-amber-700 border-amber-100',
  verified: 'bg-blue-50 text-blue-700 border-blue-100',
  assigned: 'bg-violet-50 text-violet-700 border-violet-100',
  'in-progress': 'bg-cyan-50 text-cyan-700 border-cyan-100',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  rejected: 'bg-gray-100 text-gray-500 border-gray-200',
  duplicate: 'bg-gray-100 text-gray-500 border-gray-200',
};
const SEVERITY_STYLE = {
  low: 'bg-gray-100 text-gray-600', medium: 'bg-amber-100 text-amber-700',
  high: 'bg-orange-100 text-orange-700', critical: 'bg-red-100 text-red-700',
};
const STATUS_FILTERS = ['all', 'pending', 'verified', 'assigned', 'in-progress', 'completed', 'rejected', 'duplicate'];

function StatusBadge({ status }) {
  const label = status === 'completed' ? 'resolved' : String(status || 'pending').replace('-', ' ');
  return <span className={cn('text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-md border', STATUS_STYLE[status] || STATUS_STYLE.pending)}>{label}</span>;
}

export default function IssuesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const isStaff = user?.role === 'admin' || user?.role === 'municipality_head';
  const isResearcher = user?.role === 'researcher';
  const showMap = user?.role === 'admin' || user?.role === 'municipality_head' || user?.role === 'ward_rep';
  const [selectedId, setSelectedId] = useState(null);
  const [showVerifyPrompt, setShowVerifyPrompt] = useState(false);

  const [meta, setMeta] = useState({ categories: [], authorities: [] });
  const [stats, setStats] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [viewMine, setViewMine] = useState(false);
  const [viewFlagged, setViewFlagged] = useState(false);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const handleReportClick = () => {
    if (user?.verificationStatus !== 'verified') { setShowVerifyPrompt(true); return; }
    setShowForm(true);
  };

  const load = () => {
    setLoading(true);
    const q = new URLSearchParams({ status: statusFilter, category: categoryFilter, mine: String(viewMine), flagged: String(viewFlagged) });
    Promise.all([get('/api/reports?' + q.toString()), get('/api/reports/stats')])
      .then(([r, s]) => { setReports(r.reports || []); setStats(s); })
      .catch(() => toast.error('Failed to load reports'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { get('/api/reports/meta').then(setMeta).catch(() => {}); }, []);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [statusFilter, categoryFilter, viewMine, viewFlagged]);

  const categoryLabel = (v) => meta.categories.find(c => c.value === v)?.label || v;

  const filteredReports = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reports.filter((r) => {
      const searchable = [
        r.title, r.description, r.severity, r.status, r.assignedDepartment,
        r.location?.address, r.location?.district, r.location?.municipality, r.location?.ward,
        categoryLabel(r.category),
      ].filter(Boolean).join(' ').toLowerCase();
      const matchesSearch = !q || searchable.includes(q);
      const matchesSeverity = severityFilter === 'all' || r.severity === severityFilter;
      return matchesSearch && matchesSeverity;
    });
  }, [reports, search, severityFilter, meta.categories]);

  useEffect(() => { setPage(1); }, [statusFilter, categoryFilter, viewMine, viewFlagged, search, severityFilter, pageSize]);

  const pageCount = Math.max(1, Math.ceil(filteredReports.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pagedReports = filteredReports.slice((safePage - 1) * pageSize, safePage * pageSize);

  const Filters = ({ mobile = false }) => (
    <div className={cn('grid gap-2', mobile ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_180px_180px_auto_auto]')}>
      <label className="relative min-w-0">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search title, ward, authority..." className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-brand-500" />
      </label>
      <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-brand-500">
        {STATUS_FILTERS.map(s => <option key={s} value={s}>{s === 'all' ? 'All statuses' : (s === 'completed' ? 'resolved' : s.replace('-', ' '))}</option>)}
      </select>
      <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-brand-500">
        <option value="all">All categories</option>
        {meta.categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
      </select>
      <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)} className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-brand-500">
        <option value="all">All severity</option>
        {SEVERITIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      {isStaff && (
        <div className="flex flex-wrap gap-2">
          <FilterToggle active={viewMine} onClick={() => setViewMine(v => !v)} label="Mine" />
          <FilterToggle active={viewFlagged} onClick={() => setViewFlagged(v => !v)} label="Fake" icon={ShieldAlert} />
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-[1400px] mx-auto space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Community Reports</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isStaff ? 'Review, assign, and resolve issues reported by citizens' : 'Report a flooded road, blocked tunnel, or other hazard near you'}
          </p>
        </div>
        {isResearcher && (
          <button onClick={handleReportClick} className="h-10 px-4 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 active:translate-y-px transition-all flex items-center gap-2">
            <Plus className="w-4 h-4" /> Report an issue
          </button>
        )}
      </div>

      {showVerifyPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center gap-2 text-gray-900"><ShieldCheck className="h-5 w-5 text-brand-500" /><h3 className="text-base font-bold">Verify yourself first</h3></div>
            <p className="mt-2 text-sm text-gray-500">You need to verify your identity before you can report an issue. Head to Settings to upload your citizenship certificate and take a live selfie.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowVerifyPrompt(false)} className="h-9 rounded-lg px-3 text-sm font-semibold text-gray-500 hover:bg-gray-100">Cancel</button>
              <button onClick={() => router.push('/settings')} className="h-9 rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-600">Go to Settings</button>
            </div>
          </div>
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard label="Total" value={stats.total} />
          <StatCard label="Pending Review" value={stats.pending} accent="text-amber-600" />
          <StatCard label="Active" value={stats.active} accent="text-blue-600" />
          <StatCard label="Resolved" value={stats.completed} accent="text-emerald-600" />
          <StatCard label="Flagged / Fake" value={stats.flagged} accent="text-red-600" />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-9 px-3 rounded-lg border border-gray-200 bg-white text-xs font-medium outline-none focus:border-brand-500">
          {STATUS_FILTERS.map(s => <option key={s} value={s}>{s === 'all' ? 'All statuses' : (s === 'completed' ? 'resolved' : s.replace('-', ' '))}</option>)}
        </select>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="h-9 px-3 rounded-lg border border-gray-200 bg-white text-xs font-medium outline-none focus:border-brand-500">
          <option value="all">All categories</option>
          {meta.categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        {isStaff && (
          <>
            <FilterToggle active={viewMine} onClick={() => setViewMine(v => !v)} label="Assigned/reported by me" />
            <FilterToggle active={viewFlagged} onClick={() => setViewFlagged(v => !v)} label="Flagged as fake" icon={ShieldAlert} />
          </>
        )}
      </div>

      {showMap && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Issue map</h2>
            <p className="text-xs text-gray-400">Click a pin, or hover a card below, to line them up</p>
          </div>
          <IssuesMap reports={filteredReports} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="shimmer h-[180px] rounded-2xl" />)}</div>
      ) : filteredReports.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center text-gray-400">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          No reports match these filters yet.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {pagedReports.map(r => (
            <Link
              key={r._id}
              href={`/issues/${r._id}`}
              onMouseEnter={() => showMap && setSelectedId(r._id)}
              onMouseLeave={() => showMap && setSelectedId(null)}
              className={cn(
                'group bg-white rounded-2xl border p-5 shadow-sm hover:border-gray-200 hover:shadow-md transition-all flex flex-col',
                showMap && selectedId === r._id ? 'border-brand-300 ring-2 ring-brand-100' : 'border-gray-100'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <StatusBadge status={r.status} />
                <span className={cn('text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-md', SEVERITY_STYLE[r.severity])}>{r.severity}</span>
              </div>
              <h3 className="mt-3 text-sm font-semibold text-gray-900 line-clamp-2">{r.title}</h3>
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1"><MapPin className="w-3 h-3 shrink-0" />{r.location.address}{r.location.district ? `, ${r.location.district}` : ''}</p>
              <p className="text-xs text-gray-400 mt-1">{categoryLabel(r.category)}</p>{r.photo && <img src={r.photo} alt="Report evidence" className="mt-3 h-28 w-full rounded-xl object-cover border border-gray-100" />}

              <div className="mt-3 flex flex-wrap gap-1.5">
                {r.confirmations > 1 && <span className="text-[10px] font-medium text-gray-600 bg-gray-100 rounded-md px-2 py-0.5 flex items-center gap-1"><Copy className="w-3 h-3" />{r.confirmations} reports</span>}
                {r.assignedDepartment && <span className="text-[10px] font-medium text-violet-700 bg-violet-50 rounded-md px-2 py-0.5">{r.assignedDepartment}</span>}
                {r.isFake && <span className="text-[10px] font-medium text-red-700 bg-red-50 rounded-md px-2 py-0.5 flex items-center gap-1"><ShieldAlert className="w-3 h-3" />Flagged</span>}
              </div>

              <div className="mt-auto pt-4 flex items-center justify-between text-xs text-gray-400">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{r.status === 'completed' ? `Resolved ${relativeTime(r.completedAt)}` : `ETA ${new Date(r.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}</span>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all" />
              </div>
            </Link>
          ))}
        </div>
      )}

      {!loading && filteredReports.length > 0 && (
        <Pagination
          page={safePage}
          limit={pageSize}
          total={filteredReports.length}
          onPageChange={setPage}
          onLimitChange={setPageSize}
          pageSizeOptions={[6, 12, 24, 48]}
          label="reports"
        />
      )}

      {showForm && <ReportForm meta={meta} onClose={() => setShowForm(false)} onCreated={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className={cn('text-xl font-bold mt-1 tabular-nums', accent || 'text-gray-900')}>{value}</p>
    </div>
  );
}

function FilterToggle({ active, onClick, label, icon: Icon }) {
  return (
    <button onClick={onClick} className={cn('h-9 px-3 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors', active ? 'bg-brand-50 border-brand-200 text-brand-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50')}>
      {Icon && <Icon className="w-3.5 h-3.5" />}{label}
    </button>
  );
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read the file'));
    reader.readAsDataURL(file);
  });
}
const SEVERITIES = [
  { value: 'low', label: 'Low - minor inconvenience' },
  { value: 'medium', label: 'Medium - needs attention soon' },
  { value: 'high', label: 'High - actively disruptive' },
  { value: 'critical', label: 'Critical - danger to safety' },
];

const MAX_PHOTOS = 5;

function ReportForm({ meta, onClose, onCreated }) {
  const [form, setForm] = useState({ title: '', category: meta.categories[0]?.value || 'flood', severity: 'medium', description: '', address: '', province: '', district: '', municipality: '', ward: '', reporterContact: '' });
  const [submitting, setSubmitting] = useState(false);
  const [coords, setCoords] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [photoError, setPhotoError] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handlePhotoChange = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    if (photos.length + files.length > MAX_PHOTOS) { setPhotoError(`You can add up to ${MAX_PHOTOS} photos`); return; }
    setPhotoError('');
    const next = [];
    for (const file of files) {
      if (!file.type.startsWith('image/')) { setPhotoError('Please upload images only'); continue; }
      if (file.size > 5 * 1024 * 1024) { setPhotoError('Each photo must be under 5MB'); continue; }
      try { next.push({ name: file.name, dataUrl: await fileToDataUrl(file) }); }
      catch { setPhotoError('Could not read one of the photos'); }
    }
    setPhotos(p => [...p, ...next].slice(0, MAX_PHOTOS));
  };
  const removePhoto = (idx) => setPhotos(p => p.filter((_, i) => i !== idx));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) { toast.error('Title and description are required'); return; }
    if (!form.reporterContact.trim()) { toast.error("Please add a contact number - it is required so authorities can reach you"); return; }
    if (!coords) { toast.error('Please select a location on the map'); return; }
    setSubmitting(true);
    try {
      const { report } = await post('/api/reports', {
        title: form.title, category: form.category, severity: form.severity, description: form.description,
        reporterContact: form.reporterContact,
        photo: photos[0]?.dataUrl || '', photoName: photos[0]?.name || '',
        photos: photos.map(p => p.dataUrl), photoNames: photos.map(p => p.name),
        location: { address: form.address, province: form.province, district: form.district, municipality: form.municipality, ward: form.ward, lat: coords?.lat ?? null, lng: coords?.lng ?? null },
      });
      if (report.duplicateOfTitle) {
        toast.success(`Linked to an existing report: "${report.duplicateOfTitle}". You'll be notified when it's resolved.`);
      } else {
        toast.success(`Reported - AI estimates ${report.estimatedDays} day(s) to resolve`);
      }
      onCreated();
    } catch (err) { toast.error(err.message); }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <form onClick={e => e.stopPropagation()} onSubmit={submit} className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-brand-500" />Report an issue</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-50"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-5 overflow-y-auto p-4 sm:p-5">
          <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-3 text-xs font-medium text-brand-700">Step 1 photo and details · Step 2 category · Step 3 location · Step 4 submit</div>
          <p className="text-xs leading-5 text-gray-500">Your report is checked against nearby issues. If others reported the same problem, you'll join their issue to raise its community impact - and you still get your own tracking ID.</p>

          <Field label="Title">
            <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Large pothole near Bhrikuti Chowk" className="input" />
          </Field>

          <Field label="Description">
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} placeholder="Describe the issue, when you noticed it, and how it affects the community." className="input resize-none" />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Category">
              <select value={form.category} onChange={e => set('category', e.target.value)} className="input">
                {meta.categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </Field>
            <Field label="Severity">
              <select value={form.severity} onChange={e => set('severity', e.target.value)} className="input">
                {SEVERITIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </Field>
          </div>

          <div>
            <span className="mb-1.5 block text-xs font-semibold text-gray-700">Location</span>
            <MapPicker value={coords} onChange={setCoords} />
          </div>

          <Field label="Address / landmark (optional)">
            <input value={form.address} onChange={e => set('address', e.target.value)} placeholder="Near the main bus stop" className="input" />
          </Field>

          <fieldset className="rounded-xl border border-gray-200 p-3.5">
            <legend className="px-1 text-xs font-semibold text-gray-500">Administrative area</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Province"><input value={form.province} onChange={e => set('province', e.target.value)} className="input" /></Field>
              <Field label="District"><input value={form.district} onChange={e => set('district', e.target.value)} className="input" /></Field>
              <Field label="Municipality"><input value={form.municipality} onChange={e => set('municipality', e.target.value)} className="input" /></Field>
              <Field label="Ward"><input type="number" min="1" value={form.ward} onChange={e => set('ward', e.target.value)} className="input" /></Field>
            </div>
          </fieldset>

          <div>
            <span className="block text-xs font-semibold text-gray-700 mb-1.5">Photos (optional, up to {MAX_PHOTOS})</span>
            <div className="flex flex-wrap gap-2">
              {photos.map((p, i) => (
                <div key={i} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-gray-200 sm:h-16 sm:w-16">
                  <img src={p.dataUrl} alt={p.name} className="h-full w-full object-cover" />
                  <button type="button" onClick={() => removePhoto(i)} className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"><X className="h-3 w-3" /></button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <label className="flex h-20 min-w-32 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 px-3 text-xs font-medium text-gray-500 hover:border-brand-300 hover:bg-brand-50/40 sm:h-16 sm:min-w-16">
                  <ImagePlus className="h-4 w-4" />
                  <input type="file" accept="image/*" multiple onChange={handlePhotoChange} className="hidden" />
                </label>
              )}
            </div>
            {photoError && <p className="mt-1.5 text-xs text-red-500">{photoError}</p>}
          </div>

          <Field label="Your contact number (required)">
            <input value={form.reporterContact} onChange={e => set('reporterContact', e.target.value)} placeholder="e.g. 98XXXXXXXX" className="input" required />
            <span className="block mt-1 text-[11px] text-gray-400">Used to reach you for follow-up and to verify this isn't a fake report.</span>
          </Field>
        </div>
        <div className="px-5 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
          <button type="submit" disabled={submitting} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-500 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60">
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}Submit report
          </button>
          <button type="button" onClick={onClose} className="mt-2 h-9 w-full rounded-xl text-xs font-semibold text-gray-500 hover:bg-gray-50">Cancel</button>
        </div>
      </form>
      <style jsx global>{`.input{width:100%;padding:.5rem .75rem;border-radius:.75rem;border:1px solid #e5e7eb;font-size:.813rem;outline:none}.input:focus{border-color:#2563EB}`}</style>
    </div>
  );
}

function Field({ label, children }) {
  return <label className="block"><span className="block text-xs font-semibold text-gray-700 mb-1">{label}</span>{children}</label>;
}