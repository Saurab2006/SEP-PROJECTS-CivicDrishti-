'use client';
import { useMemo, useState } from 'react';
import { cn, initials, relativeTime } from '@/lib/format';
import Pagination from '@/components/Pagination';
import { useNationalFeedback } from '@/lib/useNationalFeedback';
import {
  PROVINCES, SECTORS, FISCAL_YEARS, FEEDBACK_TYPES,
} from '@/lib/nationalFeedbackDemoData';
import { Calendar, Camera, ChevronRight, Loader2, MapPin, MessageSquareText, MessagesSquare, Search, ShieldCheck, ShieldQuestion, ShieldAlert, SlidersHorizontal, ThumbsDown, ThumbsUp, User, X } from 'lucide-react';

const TONE = {
  success: 'bg-[#eef8f3] text-[var(--gov-success)] ring-[#c8e4d6]',
  warning: 'bg-[#fff8e8] text-[#8a5a12] ring-[#f3dfb3]',
  error: 'bg-[#fff4f3] text-[var(--gov-error)] ring-[#f4bbb8]',
  neutral: 'bg-[#f2f5f8] text-[var(--gov-muted)] ring-[var(--gov-border)]',
};

const TYPE_META = {
  yes: { label: 'Yes', icon: ThumbsUp, tone: 'success', dot: 'bg-[var(--gov-success)]' },
  partially: { label: 'Partially', icon: MessageSquareText, tone: 'warning', dot: 'bg-[#b7791f]' },
  no: { label: 'No', icon: ThumbsDown, tone: 'error', dot: 'bg-[var(--gov-error)]' },
};

const VERIFICATION_META = {
  Verified: { icon: ShieldCheck, tone: 'success' },
  'Pending Review': { icon: ShieldQuestion, tone: 'warning' },
  Unverified: { icon: ShieldAlert, tone: 'neutral' },
};

const emptyFilters = { province: '', district: '', municipality: '', ward: '', project: '', sector: '', fiscalYear: '', feedbackType: '', from: '', to: '' };

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
export default function CommunityFeedbackBoard() {
  const [open, setOpen] = useState(false);
  const { rows: allRows, loading: liveLoading, error: liveError } = useNationalFeedback();

  const stats = useMemo(() => {
    return allRows.reduce((acc, row) => {
      acc.total += 1;
      acc[row.feedbackType] = (acc[row.feedbackType] || 0) + 1;
      acc.provinces.add(row.province);
      return acc;
    }, { total: 0, yes: 0, partially: 0, no: 0, provinces: new Set() });
  }, [allRows]);

  return (
    <div className="gov-card p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-4">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#fff4f3] text-[var(--gov-primary)]"><MessagesSquare className="h-4 w-4" /></span>
          <div>
            <p className="gov-label uppercase">Community feedback</p>
            <h2 className="gov-h3 mt-1">What citizens are saying, nationwide</h2>
          </div>
        </div>
        <button onClick={() => setOpen(true)} className="inline-flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-[var(--gov-primary)] px-4 text-sm font-medium text-white transition hover:bg-[var(--gov-primary-dark)] sm:w-auto">
          View all feedback <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatChip label="Total responses" value={stats.total} />
        <StatChip label="Provinces covered" value={stats.provinces.size} />
        <StatChip label="Positive (Yes)" value={stats.yes} accent="text-[var(--gov-success)]" />
        <StatChip label="Concerns (No)" value={stats.no} accent="text-[var(--gov-error)]" />
      </div>
      {liveError && <p className="mt-3 text-[11px] text-[var(--gov-subtle)]">Could not load your community's live feedback right now — showing demo coverage only. Try reopening the board in a moment.</p>}

      {open && <FeedbackBoardModal onClose={() => setOpen(false)} rows={allRows} liveLoading={liveLoading} />}
    </div>
  );
}

function StatChip({ label, value, accent }) {
  return (
    <div className="rounded-lg border border-[var(--gov-border)] bg-[var(--gov-surface-soft)] px-3 py-2.5">
      <p className="gov-label uppercase">{label}</p>
      <p className={cn('mt-1 text-lg font-semibold tabular-nums', accent || 'text-[var(--gov-text)]')}>{value}</p>
    </div>
  );
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function FeedbackBoardModal({ onClose, rows, liveLoading }) {
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState(emptyFilters);
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [showFilters, setShowFilters] = useState(false);

  const setFilter = (key, value) => {
    setFilters(prev => {
      const next = { ...prev, [key]: value };
      // Cascading resets: changing a higher level clears everything below it.
      if (key === 'province') { next.district = ''; next.municipality = ''; next.ward = ''; }
      if (key === 'district') { next.municipality = ''; next.ward = ''; }
      if (key === 'municipality') { next.ward = ''; }
      return next;
    });
    setPage(1);
  };

  const districts = useMemo(() => uniqueSorted(rows.filter(r => !filters.province || r.province === filters.province).map(r => r.district)), [rows, filters.province]);
  const municipalities = useMemo(() => uniqueSorted(rows.filter(r => (!filters.province || r.province === filters.province) && (!filters.district || r.district === filters.district)).map(r => r.municipality)), [rows, filters.province, filters.district]);
  const wards = useMemo(() => uniqueSorted(rows.filter(r => (!filters.province || r.province === filters.province) && (!filters.district || r.district === filters.district) && (!filters.municipality || r.municipality === filters.municipality)).map(r => r.ward)), [rows, filters.province, filters.district, filters.municipality]);

  const projectOptions = useMemo(() => {
    return uniqueSorted(rows
      .filter(r => (!filters.province || r.province === filters.province)
        && (!filters.district || r.district === filters.district)
        && (!filters.municipality || r.municipality === filters.municipality)
        && (!filters.ward || r.ward === filters.ward))
      .map(r => r.project));
  }, [rows, filters.province, filters.district, filters.municipality, filters.ward]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = rows.filter(row => {
      if (filters.province && row.province !== filters.province) return false;
      if (filters.district && row.district !== filters.district) return false;
      if (filters.municipality && row.municipality !== filters.municipality) return false;
      if (filters.ward && row.ward !== filters.ward) return false;
      if (filters.project && row.project !== filters.project) return false;
      if (filters.sector && row.sector !== filters.sector) return false;
      if (filters.fiscalYear && row.fiscalYear !== filters.fiscalYear) return false;
      if (filters.feedbackType && row.feedbackType !== filters.feedbackType) return false;
      if (filters.from && new Date(row.date) < new Date(filters.from)) return false;
      if (filters.to && new Date(row.date) > new Date(`${filters.to}T23:59:59`)) return false;
      if (needle) {
        const haystack = `${row.isAnonymous ? 'anonymous' : row.citizenName} ${row.project} ${row.comment} ${row.province} ${row.district} ${row.municipality} ward ${row.ward}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
    out = [...out].sort((a, b) => {
      if (sort === 'oldest') return new Date(a.date) - new Date(b.date);
      if (sort === 'verification') return a.verificationStatus.localeCompare(b.verificationStatus);
      if (sort === 'province') return a.province.localeCompare(b.province) || a.district.localeCompare(b.district);
      return new Date(b.date) - new Date(a.date);
    });
    return out;
  }, [rows, q, filters, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / limit));
  const safePage = Math.min(page, totalPages);
  const visible = filtered.slice((safePage - 1) * limit, safePage * limit);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const resetAll = () => { setFilters(emptyFilters); setQ(''); setPage(1); };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center overflow-hidden bg-black/40 sm:items-center sm:overflow-y-auto sm:p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="flex h-full w-full max-w-5xl flex-col bg-white shadow-xl sm:h-auto sm:max-h-[95vh] sm:rounded-xl">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--gov-border)] px-4 py-4 sm:px-6">
          <div>
            <p className="gov-label uppercase">Community feedback · All 7 provinces</p>
            <h3 className="gov-h3 mt-1">National feedback board</h3>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-lg p-1.5 text-[var(--gov-subtle)] hover:bg-[var(--gov-surface-soft)]"><X className="h-4 w-4" /></button>
        </div>

        <div className="max-h-[46vh] overflow-y-auto border-b border-[var(--gov-border)] px-4 py-3 sm:max-h-none sm:overflow-visible sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--gov-subtle)]" />
              <input value={q} onChange={e => { setQ(e.target.value); setPage(1); }} placeholder="Search by citizen, project, ward, or comment..." className="h-10 w-full rounded-lg border border-[var(--gov-border)] pl-9 pr-3 text-sm outline-none focus:border-[var(--gov-primary)]" />
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setShowFilters(v => !v)} className={cn('flex h-10 flex-1 shrink-0 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-medium sm:flex-none', showFilters ? 'border-[var(--gov-primary)] bg-[#fff4f3] text-[var(--gov-primary)]' : 'border-[var(--gov-border)] text-[var(--gov-muted)] hover:bg-[var(--gov-surface-soft)]')}>
                <SlidersHorizontal className="h-4 w-4" />Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}
              </button>
              {(activeFilterCount > 0 || q) && <button type="button" onClick={resetAll} className="h-10 shrink-0 rounded-lg px-3 text-sm font-medium text-[var(--gov-primary)] hover:bg-[#fff4f3]">Reset</button>}
            </div>
          </div>

          {showFilters && (
            <div className="mt-3 space-y-2">
              <p className="gov-label uppercase">Location: Province → District → Municipality → Ward</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <FilterSelect label="Province" value={filters.province} onChange={v => setFilter('province', v)} options={PROVINCES} />
                <FilterSelect label="District" value={filters.district} onChange={v => setFilter('district', v)} options={districts} disabled={!filters.province} />
                <FilterSelect label="Municipality" value={filters.municipality} onChange={v => setFilter('municipality', v)} options={municipalities} disabled={!filters.district} />
                <FilterSelect label="Ward" value={filters.ward} onChange={v => setFilter('ward', v)} options={wards} disabled={!filters.municipality} prefix="Ward " />
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
                <FilterSelect label="Project" value={filters.project} onChange={v => setFilter('project', v)} options={projectOptions} />
                <FilterSelect label="Sector" value={filters.sector} onChange={v => setFilter('sector', v)} options={SECTORS} />
                <FilterSelect label="Fiscal year" value={filters.fiscalYear} onChange={v => setFilter('fiscalYear', v)} options={FISCAL_YEARS} />
                <FilterSelect label="Feedback type" value={filters.feedbackType} onChange={v => setFilter('feedbackType', v)} options={FEEDBACK_TYPES.map(t => t.value)} labels={Object.fromEntries(FEEDBACK_TYPES.map(t => [t.value, t.label]))} />
                <div className="grid grid-cols-2 gap-1">
                  <label className="block"><span className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--gov-subtle)]">From</span><input type="date" value={filters.from} onChange={e => setFilter('from', e.target.value)} className="h-9 w-full rounded-lg border border-[var(--gov-border)] px-1.5 text-xs outline-none focus:border-[var(--gov-primary)]" /></label>
                  <label className="block"><span className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--gov-subtle)]">To</span><input type="date" value={filters.to} onChange={e => setFilter('to', e.target.value)} className="h-9 w-full rounded-lg border border-[var(--gov-border)] px-1.5 text-xs outline-none focus:border-[var(--gov-primary)]" /></label>
                </div>
              </div>
              {(filters.province || filters.district || filters.municipality || filters.ward) && (
                <p className="flex items-center gap-1 text-xs text-[var(--gov-primary)]"><MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="break-words">Showing: {[filters.province, filters.district, filters.municipality, filters.ward && `Ward ${filters.ward}`].filter(Boolean).join(' → ')}</span>
                </p>
              )}
            </div>
          )}

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-1.5 text-xs text-[var(--gov-muted)]">
              {liveLoading && <Loader2 className="h-3 w-3 animate-spin" />}
              {filtered.length} matching feedback {filtered.length === 1 ? 'entry' : 'entries'}
            </p>
            <label className="flex items-center gap-2 text-xs text-[var(--gov-muted)]">
              Sort by
              <select value={sort} onChange={e => setSort(e.target.value)} className="h-9 flex-1 rounded-lg border border-[var(--gov-border)] px-2 text-xs outline-none focus:border-[var(--gov-primary)] sm:flex-none">
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="verification">Verification status</option>
                <option value="province">Province / district</option>
              </select>
            </label>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {visible.length === 0 ? (
            <p className="rounded-lg bg-[var(--gov-surface-soft)] p-6 text-center text-sm text-[var(--gov-muted)]">No feedback matches these filters. Try widening your search.</p>
          ) : (
            <div className="space-y-2.5">{visible.map(row => <NationalFeedbackCard key={row.id} row={row} />)}</div>
          )}
        </div>

        <div className="border-t border-[var(--gov-border)] p-3 sm:p-4">
          <Pagination page={safePage} limit={limit} total={filtered.length} onPageChange={setPage} onLimitChange={v => { setLimit(v); setPage(1); }} pageSizeOptions={[10, 20, 50]} label="feedback entries" />
        </div>
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options, disabled, prefix = '', labels }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--gov-subtle)]">{label}</span>
      <select disabled={disabled} value={value} onChange={e => onChange(e.target.value)} className="h-9 w-full rounded-lg border border-[var(--gov-border)] px-2 text-xs outline-none focus:border-[var(--gov-primary)] disabled:cursor-not-allowed disabled:bg-[var(--gov-surface-soft)] disabled:text-[var(--gov-subtle)]">
        <option value="">All</option>
        {options.map(opt => <option key={opt} value={opt}>{prefix}{(labels && labels[opt]) || opt}</option>)}
      </select>
    </label>
  );
}

function NationalFeedbackCard({ row }) {
  const type = TYPE_META[row.feedbackType] || TYPE_META.yes;
  const TypeIcon = type.icon;
  const verification = VERIFICATION_META[row.verificationStatus] || VERIFICATION_META.Unverified;
  const VerifyIcon = verification.icon;
  const displayName = row.isAnonymous ? 'Anonymous Citizen' : row.citizenName;

  return (
    <div className="rounded-lg border border-[var(--gov-border)] bg-white p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#fff4f3] text-[10px] font-semibold text-[var(--gov-primary)]">{row.isAnonymous ? <User className="h-3.5 w-3.5" /> : (initials(displayName) || <User className="h-3.5 w-3.5" />)}</span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-1 text-xs font-semibold text-[var(--gov-text)]">
              {displayName}
              {row.isDemo
                ? <span className="font-normal text-[var(--gov-subtle)]">· Demo feedback</span>
                : <span className="rounded-md bg-[#eef8f3] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--gov-success)]">Live</span>}
            </p>
            <p className="flex flex-wrap items-center gap-x-1 text-[11px] text-[var(--gov-subtle)]"><MapPin className="h-2.5 w-2.5 shrink-0" />{row.province} → {row.district} → {row.municipality} → Ward {row.ward}</p>
            {!row.isDemo && row.registeredWard && row.registeredWard !== row.ward && (
              <p className="text-[10px] text-[var(--gov-subtle)]">Citizen's registered ward: Ward {row.registeredWard}</p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <span className={cn('flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset', TONE[type.tone])}><TypeIcon className="h-3 w-3" />{type.label}</span>
          <span className={cn('flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset', TONE[verification.tone])}><VerifyIcon className="h-3 w-3" />{row.verificationStatus}</span>
        </div>
      </div>

      <p className="mt-2 text-xs font-medium text-[var(--gov-primary)]">{row.project}</p>
      <p className="mt-0.5 text-[11px] text-[var(--gov-subtle)]">{row.sector} · FY {row.fiscalYear}</p>
      {row.comment && <p className="mt-1.5 text-xs leading-relaxed text-[var(--gov-muted)]">{row.comment}</p>}

      {!row.isDemo && row.photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={row.photoUrl} alt="Citizen submitted evidence" className="mt-2 h-28 w-full rounded-lg border border-[var(--gov-border)] object-cover" />
      )}

      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-[var(--gov-subtle)]">
        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(row.date)}{!row.isDemo ? ` · ${relativeTime(row.date)}` : ''}</span>
        {row.isDemo && row.hasPhoto && (
          <span className="flex items-center gap-1.5">
            <Camera className="h-3 w-3" />Photo attached
            <span className="h-4 w-6 rounded border border-[var(--gov-border)]" style={{ backgroundColor: row.photoColor }} title="Demo photo placeholder" />
          </span>
        )}
      </div>
    </div>
  );
}