'use client';
import { useMemo, useState } from 'react';
import { cn, initials, relativeTime } from '@/lib/format';
import Pagination from '@/components/Pagination';
import { useNationalFeedback } from '@/lib/useNationalFeedback';
import {
  PROVINCES, SECTORS, FISCAL_YEARS, FEEDBACK_TYPES,
} from '@/lib/nationalFeedbackDemoData';
import { Calendar, Camera, ChevronRight, Loader2, MapPin, MessageSquareText, Search, ShieldCheck, ShieldQuestion, ShieldAlert, SlidersHorizontal, ThumbsDown, ThumbsUp, User, X } from 'lucide-react';

const TYPE_META = {
  yes: { label: 'Yes', icon: ThumbsUp, className: 'border-emerald-300 bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  partially: { label: 'Partially', icon: MessageSquareText, className: 'border-amber-300 bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  no: { label: 'No', icon: ThumbsDown, className: 'border-red-300 bg-red-50 text-red-700', dot: 'bg-red-500' },
};

const VERIFICATION_META = {
  Verified: { icon: ShieldCheck, className: 'border-emerald-300 bg-emerald-50 text-emerald-700' },
  'Pending Review': { icon: ShieldQuestion, className: 'border-amber-300 bg-amber-50 text-amber-700' },
  Unverified: { icon: ShieldAlert, className: 'border-slate-300 bg-slate-50 text-slate-600' },
};

const emptyFilters = { province: '', district: '', municipality: '', ward: '', project: '', sector: '', fiscalYear: '', feedbackType: '', from: '', to: '' };

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Top-of-page summary card. Always visible on the Public Budget view - this
// is the entry point into the full national feedback board, it does not
// replace the existing per-project feedback panel used elsewhere on this page.
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
    <div className="rounded-lg border border-[#ded6c8] bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#dc143c]">Community Feedback</p>
          <h2 className="mt-0.5 text-lg font-medium text-[#102a2b]">What citizens are saying, nationwide</h2>
        </div>
        <button onClick={() => setOpen(true)} className="flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-[#0f3d3e] px-5 text-sm font-black text-white hover:bg-[#102a2b] sm:w-auto">
          View All Feedback <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatChip label="Total responses" value={stats.total} />
        <StatChip label="Provinces covered" value={stats.provinces.size} />
        <StatChip label="Positive (Yes)" value={stats.yes} accent="text-emerald-600" />
        <StatChip label="Concerns (No)" value={stats.no} accent="text-red-600" />
      </div>
      {liveError && <p className="mt-2 text-[11px] text-[#8c8272]">Could not load your community's live feedback right now - showing demo coverage only. Try reopening the board in a moment.</p>}

      {open && <FeedbackBoardModal onClose={() => setOpen(false)} rows={allRows} liveLoading={liveLoading} />}
    </div>
  );
}

function StatChip({ label, value, accent }) {
  return (
    <div className="rounded-lg border border-[#eee6d8] bg-[#fffaf2] px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-[#8c8272]">{label}</p>
      <p className={cn('mt-0.5 text-lg font-black tabular-nums', accent || 'text-[#102a2b]')}>{value}</p>
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

  // Location filter options are derived from the live data (real + demo)
  // rather than a fixed lookup table, so a citizen's own registered
  // district/municipality/ward always shows up as a selectable filter -
  // even though real accounts type their location freely at signup.
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
      <div onClick={e => e.stopPropagation()} className="flex h-full w-full max-w-5xl flex-col rounded-none bg-white shadow-xl sm:h-auto sm:max-h-[95vh] sm:rounded-lg">
        <div className="flex items-start justify-between gap-3 border-b border-[#eee6d8] px-4 py-4 sm:px-6">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#dc143c]">Community Feedback · All 7 provinces</p>
            <h3 className="mt-0.5 text-base font-black text-[#102a2b]">National feedback board</h3>
            <p className="mt-1 text-xs text-[#65706c]">Citizen names shown as registered; phone, email, and address are never shown here. Real feedback appears alongside <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700">Demo Data</span>.</p>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-lg p-1.5 text-[#8c8272] hover:bg-[#fffaf2]"><X className="h-4 w-4" /></button>
        </div>

        <div className="max-h-[46vh] overflow-y-auto border-b border-[#eee6d8] px-4 py-3 sm:max-h-none sm:overflow-visible sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8c8272]" />
              <input value={q} onChange={e => { setQ(e.target.value); setPage(1); }} placeholder="Search by citizen, project, ward, or comment..." className="h-10 w-full rounded-lg border border-[#ded6c8] pl-9 pr-3 text-sm outline-none focus:border-[#0f3d3e]" />
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setShowFilters(v => !v)} className={cn('flex h-10 flex-1 shrink-0 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-medium sm:flex-none', showFilters ? 'border-[#0f3d3e] bg-[#eef6f4] text-[#0f3d3e]' : 'border-[#ded6c8] text-[#65706c] hover:bg-[#fffaf2]')}>
                <SlidersHorizontal className="h-4 w-4" />Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}
              </button>
              {(activeFilterCount > 0 || q) && <button type="button" onClick={resetAll} className="h-10 shrink-0 rounded-lg px-3 text-sm font-medium text-[#dc143c] hover:bg-[#fff4f3]">Reset</button>}
            </div>
          </div>

          {showFilters && (
            <div className="mt-3 space-y-2">
              <p className="text-[11px] font-black uppercase tracking-wide text-[#8c8272]">Location: Province → District → Municipality → Ward</p>
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
                  <label className="block"><span className="mb-1 block text-[10px] uppercase tracking-wide text-[#8c8272]">From</span><input type="date" value={filters.from} onChange={e => setFilter('from', e.target.value)} className="h-9 w-full rounded-lg border border-[#ded6c8] px-1.5 text-xs outline-none focus:border-[#0f3d3e]" /></label>
                  <label className="block"><span className="mb-1 block text-[10px] uppercase tracking-wide text-[#8c8272]">To</span><input type="date" value={filters.to} onChange={e => setFilter('to', e.target.value)} className="h-9 w-full rounded-lg border border-[#ded6c8] px-1.5 text-xs outline-none focus:border-[#0f3d3e]" /></label>
                </div>
              </div>
              {(filters.province || filters.district || filters.municipality || filters.ward) && (
                <p className="flex items-center gap-1 text-xs text-[#0f3d3e]"><MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="break-words">Showing: {[filters.province, filters.district, filters.municipality, filters.ward && `Ward ${filters.ward}`].filter(Boolean).join(' → ')}</span>
                </p>
              )}
            </div>
          )}

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-1.5 text-xs text-[#65706c]">
              {liveLoading && <Loader2 className="h-3 w-3 animate-spin" />}
              {filtered.length} matching feedback {filtered.length === 1 ? 'entry' : 'entries'}
            </p>
            <label className="flex items-center gap-2 text-xs text-[#65706c]">
              Sort by
              <select value={sort} onChange={e => setSort(e.target.value)} className="h-9 flex-1 rounded-lg border border-[#ded6c8] px-2 text-xs outline-none focus:border-[#0f3d3e] sm:flex-none">
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
            <p className="rounded-lg bg-[#f8fbfd] p-6 text-center text-sm text-[#65706c]">No feedback matches these filters. Try widening your search.</p>
          ) : (
            <div className="space-y-2.5">{visible.map(row => <NationalFeedbackCard key={row.id} row={row} />)}</div>
          )}
        </div>

        <div className="border-t border-[#eee6d8] p-3 sm:p-4">
          <Pagination page={safePage} limit={limit} total={filtered.length} onPageChange={setPage} onLimitChange={v => { setLimit(v); setPage(1); }} pageSizeOptions={[10, 20, 50]} label="feedback entries" />
        </div>
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options, disabled, prefix = '', labels }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-wide text-[#8c8272]">{label}</span>
      <select disabled={disabled} value={value} onChange={e => onChange(e.target.value)} className="h-9 w-full rounded-lg border border-[#ded6c8] px-2 text-xs outline-none focus:border-[#0f3d3e] disabled:cursor-not-allowed disabled:bg-[#f7f2ea] disabled:text-[#b8ad9b]">
        <option value="">All</option>
        {options.map(opt => <option key={opt} value={opt}>{prefix}{(labels && labels[opt]) || opt}</option>)}
      </select>
    </label>
  );
}

// Deliberately renders only citizen name/Anonymous + registered location -
// never phone, email, or street address, matching the same public-projection
// rule used by the live per-project feedback endpoint.
function NationalFeedbackCard({ row }) {
  const type = TYPE_META[row.feedbackType] || TYPE_META.yes;
  const TypeIcon = type.icon;
  const verification = VERIFICATION_META[row.verificationStatus] || VERIFICATION_META.Unverified;
  const VerifyIcon = verification.icon;
  const displayName = row.isAnonymous ? 'Anonymous Citizen' : row.citizenName;

  return (
    <div className="rounded-lg border border-[#eee6d8] bg-white p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#eef6f4] text-[10px] font-black text-[#0f3d3e]">{row.isAnonymous ? <User className="h-3.5 w-3.5" /> : (initials(displayName) || <User className="h-3.5 w-3.5" />)}</span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-1 text-xs font-black text-[#102a2b]">
              {displayName}
              {row.isDemo
                ? <span className="font-normal text-[#8c8272]">· Demo feedback</span>
                : <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-emerald-700">Live</span>}
            </p>
            <p className="flex flex-wrap items-center gap-x-1 text-[11px] text-[#8c8272]"><MapPin className="h-2.5 w-2.5 shrink-0" />{row.province} → {row.district} → {row.municipality} → Ward {row.ward}</p>
            {!row.isDemo && row.registeredWard && row.registeredWard !== row.ward && (
              <p className="text-[10px] text-[#b8ad9b]">Citizen's registered ward: Ward {row.registeredWard}</p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <span className={cn('flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide', type.className)}><TypeIcon className="h-3 w-3" />{type.label}</span>
          <span className={cn('flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide', verification.className)}><VerifyIcon className="h-3 w-3" />{row.verificationStatus}</span>
        </div>
      </div>

      <p className="mt-2 text-xs font-medium text-[#0f3d3e]">{row.project}</p>
      <p className="mt-0.5 text-[11px] text-[#8c8272]">{row.sector} · FY {row.fiscalYear}</p>
      {row.comment && <p className="mt-1.5 text-xs leading-relaxed text-[#65706c]">{row.comment}</p>}

      {!row.isDemo && row.photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={row.photoUrl} alt="Citizen submitted evidence" className="mt-2 h-28 w-full rounded-lg border border-[#eee6d8] object-cover" />
      )}

      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-[#8c8272]">
        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(row.date)}{!row.isDemo ? ` · ${relativeTime(row.date)}` : ''}</span>
        {row.isDemo && row.hasPhoto && (
          <span className="flex items-center gap-1.5">
            <Camera className="h-3 w-3" />Photo attached
            <span className="h-4 w-6 rounded border border-[#eee6d8]" style={{ backgroundColor: row.photoColor }} title="Demo photo placeholder" />
          </span>
        )}
      </div>
    </div>
  );
}