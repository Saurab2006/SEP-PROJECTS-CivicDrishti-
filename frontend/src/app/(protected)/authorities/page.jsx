'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { get, post } from '@/lib/api';
import { relativeTime, cn } from '@/lib/format';
import { toast } from 'sonner';
import { Building2, Star, Plus, Loader2, X, Phone, Mail, MapPin, ChevronDown, ChevronUp, Trophy, Medal, Clock, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import LocationLeaderboard from '@/components/LocationLeaderboard';
import { useNationalFeedback } from '@/lib/useNationalFeedback';

export default function AuthoritiesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [tab, setTab] = useState('directory'); // 'directory' | 'leaderboard' | 'budgetLeaderboard'
  const [authorities, setAuthorities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [districtFilter, setDistrictFilter] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const load = () => {
    setLoading(true);
    const q = districtFilter ? `?district=${encodeURIComponent(districtFilter)}` : '';
    get('/api/authorities' + q)
      .then(r => setAuthorities(r.authorities || []))
      .catch(() => toast.error('Failed to load authorities'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (tab === 'directory') load(); /* eslint-disable-next-line */ }, [districtFilter, tab]);

  return (
    <div className="mx-auto max-w-[1200px] space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="mt-1 text-2xl font-black text-[#102a2b]">Authorities</h1>
        </div>
        {isAdmin && tab === 'directory' && (
          <button onClick={() => setShowAddForm(true)} className="flex h-10 items-center gap-2 rounded-lg bg-[#dc143c] px-4 text-sm font-black text-white hover:bg-[#b80f31]">
            <Plus className="h-4 w-4" /> Add Authority
          </button>
        )}
      </div>

      <div className="flex w-fit rounded-lg border border-[#ded6c8] bg-white p-1 shadow-sm">
        <button onClick={() => setTab('directory')} className={cn('rounded-md px-4 py-2 text-sm font-black transition-colors', tab === 'directory' ? 'bg-[#0f3d3e] text-white' : 'text-[#65706c] hover:text-[#102a2b]')}>
          Directory
        </button>
        <button onClick={() => setTab('leaderboard')} className={cn('rounded-md px-4 py-2 text-sm font-black transition-colors', tab === 'leaderboard' ? 'bg-[#0f3d3e] text-white' : 'text-[#65706c] hover:text-[#102a2b]')}>
          Leaderboard
        </button>
        <button onClick={() => setTab('budgetLeaderboard')} className={cn('rounded-md px-4 py-2 text-sm font-black transition-colors', tab === 'budgetLeaderboard' ? 'bg-[#0f3d3e] text-white' : 'text-[#65706c] hover:text-[#102a2b]')}>
          Budget Leaderboard
        </button>
      </div>

      {tab === 'directory' ? (
        <>
          <div className="rounded-lg border border-[#ded6c8] bg-white p-4 shadow-sm">
            <input value={districtFilter} onChange={e => setDistrictFilter(e.target.value)} placeholder="Filter by district..." className="h-10 w-full max-w-xs rounded-lg border border-[#ded6c8] bg-[#fffcf7] px-3 text-sm font-medium text-[#102a2b] outline-none focus:border-[#0f3d3e]" />
          </div>

          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="shimmer h-[150px] rounded-lg" />)}</div>
          ) : authorities.length === 0 ? (
            <div className="rounded-lg border border-[#ded6c8] bg-white p-16 text-center text-[#8c8272] shadow-sm">
              <Building2 className="mx-auto mb-2 h-8 w-8 text-[#cfc4b4]" />
              No authorities registered yet.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {authorities.map(a => <AuthorityCard key={a._id} authority={a} expanded={expanded === a._id} onToggle={() => setExpanded(expanded === a._id ? null : a._id)} onChanged={load} />)}
            </div>
          )}

          {showAddForm && <AddAuthorityForm onClose={() => setShowAddForm(false)} onCreated={() => { setShowAddForm(false); load(); }} />}
        </>
      ) : tab === 'leaderboard' ? (
        <Leaderboard />
      ) : (
        <BudgetLeaderboardTab />
      )}
    </div>
  );
}

function Leaderboard() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    get('/api/authorities/leaderboard')
      .then(r => setRows(r.leaderboard || []))
      .catch(() => toast.error('Failed to load leaderboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="shimmer h-[72px] rounded-lg" />)}</div>;
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-[#ded6c8] bg-white p-16 text-center text-[#8c8272] shadow-sm">
        <Trophy className="mx-auto mb-2 h-8 w-8 text-[#cfc4b4]" />
        No authorities to rank yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[#ded6c8] bg-white shadow-sm">
      <div className="hidden grid-cols-[48px_1fr_120px_140px_140px] gap-3 border-b border-[#eee6d8] bg-[#fffaf2] px-4 py-3 text-[11px] font-black uppercase tracking-wide text-[#8c8272] sm:grid">
        <span>#</span>
        <span>Authority</span>
        <span>Rating</span>
        <span>Resolution time</span>
        <span>Completion rate</span>
      </div>
      <div className="divide-y divide-[#eee6d8]">
        {rows.map((a, i) => <LeaderboardRow key={a._id} authority={a} rank={i + 1} />)}
      </div>
    </div>
  );
}

function BudgetLeaderboardTab() {
  const router = useRouter();
  const { rows } = useNationalFeedback();
  return (
    <LocationLeaderboard
      rows={rows}
      title="Budget Leaderboard"
      subtitle="All locations, ranked by citizen approval"
      onViewAll={() => router.push('/budget')}
      viewAllLabel="Open full feedback board in Public Budget"
    />
  );
}

function LeaderboardRow({ authority, rank }) {
  const medalColor = rank === 1 ? 'text-amber-500' : rank === 2 ? 'text-slate-400' : rank === 3 ? 'text-amber-700' : null;

  return (
    <div className="grid grid-cols-2 gap-3 px-4 py-3 sm:grid-cols-[48px_1fr_120px_140px_140px] sm:items-center">
      <div className="flex items-center gap-1">
        {medalColor ? <Medal className={cn('h-5 w-5', medalColor)} /> : <span className="w-5 text-center text-sm font-black text-[#8c8272]">{rank}</span>}
      </div>

      <div className="col-span-2 sm:col-span-1">
        <p className="text-sm font-black text-[#102a2b]">{authority.name}</p>
        {authority.district && <p className="flex items-center gap-1 text-xs text-[#65706c]"><MapPin className="h-3 w-3" />{authority.district}</p>}
      </div>

      <div className="flex items-center gap-1">
        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
        <span className="text-sm font-black text-[#102a2b]">{authority.ratingAvg?.toFixed(1) || '0.0'}</span>
        <span className="text-xs text-[#8c8272]">({authority.ratingCount})</span>
      </div>

      <div className="flex items-center gap-1 text-sm text-[#102a2b]">
        <Clock className="h-3.5 w-3.5 text-[#8c8272]" />
        {authority.resolutionDays != null ? <span className="font-bold">{authority.resolutionDays}d avg</span> : <span className="text-[#8c8272]">No data</span>}
      </div>

      <div className="flex items-center gap-1 text-sm text-[#102a2b]">
        <CheckCircle2 className="h-3.5 w-3.5 text-[#8c8272]" />
        {authority.completionRate != null ? (
          <span className="font-bold">{authority.completionRate}% <span className="font-normal text-[#8c8272]">({authority.completed}/{authority.totalAssigned})</span></span>
        ) : <span className="text-[#8c8272]">No data</span>}
      </div>
    </div>
  );
}

function AuthorityCard({ authority, expanded, onToggle, onChanged }) {
  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    setLoadingReviews(true);
    get(`/api/authorities/${authority._id}/reviews`).then(r => setReviews(r.reviews || [])).catch(() => {}).finally(() => setLoadingReviews(false));
  }, [expanded, authority._id]);

  const submitReview = async () => {
    setSubmitting(true);
    try {
      await post(`/api/authorities/${authority._id}/reviews`, { rating, comment });
      toast.success('Review submitted');
      setComment('');
      const r = await get(`/api/authorities/${authority._id}/reviews`);
      setReviews(r.reviews || []);
      onChanged();
    } catch (err) { toast.error(err.message); }
    setSubmitting(false);
  };

  return (
    <div className="flex flex-col rounded-lg border border-[#ded6c8] bg-white p-5 shadow-sm">
      <div>
        <h3 className="text-sm font-black text-[#102a2b]">{authority.name}</h3>
        {authority.district && <p className="mt-1 flex items-center gap-1 text-xs text-[#65706c]"><MapPin className="h-3 w-3" />{authority.district}</p>}
      </div>

      <div className="mt-3 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map(n => <Star key={n} className={cn('h-3.5 w-3.5', n <= Math.round(authority.ratingAvg) ? 'fill-amber-400 text-amber-400' : 'text-[#ded6c8]')} />)}
        <span className="ml-1 text-xs font-black text-[#102a2b]">{authority.ratingAvg?.toFixed(1) || '0.0'}</span>
        <span className="text-xs text-[#8c8272]">({authority.ratingCount || 0} review{authority.ratingCount === 1 ? '' : 's'})</span>
      </div>

      {(authority.contactEmail || authority.contactPhone) && (
        <div className="mt-2 space-y-1">
          {authority.contactPhone && <p className="flex items-center gap-1 text-xs text-[#65706c]"><Phone className="h-3 w-3" />{authority.contactPhone}</p>}
          {authority.contactEmail && <p className="flex items-center gap-1 text-xs text-[#65706c]"><Mail className="h-3 w-3" />{authority.contactEmail}</p>}
        </div>
      )}

      <button onClick={onToggle} className="mt-3 flex items-center gap-1 text-xs font-black text-[#dc143c] hover:underline">
        {expanded ? <>Hide reviews <ChevronUp className="h-3.5 w-3.5" /></> : <>See reviews & rate <ChevronDown className="h-3.5 w-3.5" /></>}
      </button>

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-[#eee6d8] pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map(n => <button key={n} type="button" onClick={() => setRating(n)}><Star className={cn('h-4 w-4', n <= rating ? 'fill-amber-400 text-amber-400' : 'text-[#ded6c8]')} /></button>)}
            </div>
            <input value={comment} onChange={e => setComment(e.target.value)} placeholder="Add a comment (optional)" className="h-8 min-w-[140px] flex-1 rounded-lg border border-[#ded6c8] px-2 text-xs outline-none focus:border-[#0f3d3e]" />
            <button disabled={submitting} onClick={submitReview} className="h-8 rounded-lg bg-[#0f3d3e] px-3 text-xs font-black text-white hover:bg-[#102a2b] disabled:opacity-60">
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Rate'}
            </button>
          </div>

          {loadingReviews ? <div className="shimmer h-12 rounded-lg" /> : reviews.length === 0 ? <p className="text-xs text-[#8c8272]">No reviews yet.</p> : (
            <div className="max-h-40 space-y-2 overflow-y-auto">
              {reviews.map(r => <div key={r._id} className="text-xs"><div className="flex items-center gap-1">{[1, 2, 3, 4, 5].map(n => <Star key={n} className={cn('h-2.5 w-2.5', n <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-[#ded6c8]')} />)}<span className="font-bold text-[#102a2b]">{r.user?.name || 'User'}</span><span className="text-[10px] text-[#8c8272]">- {relativeTime(r.createdAt)}</span></div>{r.comment && <p className="mt-0.5 text-[#65706c]">{r.comment}</p>}</div>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AddAuthorityForm({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', department: '', district: '', contactEmail: '', contactPhone: '' });
  const [submitting, setSubmitting] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Authority name is required'); return; }
    setSubmitting(true);
    try { await post('/api/authorities', form); toast.success('Authority added'); onCreated(); }
    catch (err) { toast.error(err.message); }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <form onClick={e => e.stopPropagation()} onSubmit={submit} className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#eee6d8] px-5 py-4">
          <h3 className="flex items-center gap-2 text-sm font-black text-[#102a2b]"><Building2 className="h-4 w-4 text-[#dc143c]" />Add Authority</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-[#8c8272] hover:bg-[#fffaf2]"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 p-5">
          <Field label="Name"><input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Department of Roads - Kathmandu" className="input" /></Field>
          <Field label="Department"><input value={form.department} onChange={e => set('department', e.target.value)} className="input" /></Field>
          <Field label="District"><input value={form.district} onChange={e => set('district', e.target.value)} className="input" /></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Contact phone"><input value={form.contactPhone} onChange={e => set('contactPhone', e.target.value)} className="input" /></Field><Field label="Contact email"><input value={form.contactEmail} onChange={e => set('contactEmail', e.target.value)} className="input" /></Field></div>
        </div>
        <div className="flex justify-end gap-2 border-t border-[#eee6d8] px-5 py-4">
          <button type="button" onClick={onClose} className="h-10 rounded-lg border border-[#ded6c8] px-4 text-sm font-black text-[#102a2b] hover:bg-[#fffaf2]">Cancel</button>
          <button type="submit" disabled={submitting} className="flex h-10 items-center gap-2 rounded-lg bg-[#dc143c] px-4 text-sm font-black text-white hover:bg-[#b80f31] disabled:opacity-60">{submitting && <Loader2 className="h-4 w-4 animate-spin" />}Add Authority</button>
        </div>
      </form>
      <style jsx global>{`.input{width:100%;padding:.5rem .75rem;border-radius:.5rem;border:1px solid #ded6c8;background:#fffcf7;font-size:.813rem;outline:none}.input:focus{border-color:#0f3d3e}`}</style>
    </div>
  );
}

function Field({ label, children }) {
  return <label className="block"><span className="mb-1 block text-xs font-black text-[#102a2b]">{label}</span>{children}</label>;
}