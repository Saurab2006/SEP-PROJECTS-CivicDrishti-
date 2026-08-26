'use client';
import { useEffect, useMemo, useState } from 'react';
import { get, patch, post, getToken } from '@/lib/api';
import { formatNPR, cn, relativeTime, initials } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';
import {
  AlertTriangle, Check, CheckCircle2, ChevronRight, Clock3, Download, Eye,
  Landmark, ListTree, Map, MapPin, MessageSquare, PiggyBank, Search, Send, SlidersHorizontal,
  Table2, ThumbsDown, ThumbsUp, TrendingDown, TrendingUp, User, Wallet, X,
} from 'lucide-react';
import { toast } from 'sonner';
import Pagination from '@/components/Pagination';
import CommunityFeedbackBoard from '@/components/CommunityFeedbackBoard';

const emptyProposal = {
  title: '', department: '', sector: '', fiscalYear: '', district: '', municipality: '', ward: '',
  amount: '', originalApprovedBudget: '', revisedBudget: '', releasedAmount: '', contractedAmount: '', paidAmount: '',
  expenditureType: 'Capital Expenditure', programType: 'Infrastructure', reason: '',
  status: '', timelineStart: '', timelineEnd: '',
};
const LEVELS = ['province', 'district', 'municipality', 'ward'];
const LEVEL_LABEL = { province: 'Province', district: 'District', municipality: 'Municipality', ward: 'Ward' };


const TONE = {
  neutral: 'bg-[#f2f5f8] text-[var(--gov-muted)] ring-[var(--gov-border)]',
  info: 'bg-[#eef5fb] text-[var(--gov-info)] ring-[#cbd9e8]',
  warning: 'bg-[#fff8e8] text-[#8a5a12] ring-[#f3dfb3]',
  success: 'bg-[#eef8f3] text-[var(--gov-success)] ring-[#c8e4d6]',
  error: 'bg-[#fff4f3] text-[var(--gov-error)] ring-[#f4bbb8]',
};

const STAGE_TONE = {
  proposed: 'neutral', 'budget-approved': 'info', procurement: 'warning', 'contract-awarded': 'info',
  'work-started': 'warning', 'in-progress': 'warning', completed: 'success', inspected: 'success', closed: 'neutral',
  planned: 'neutral', ongoing: 'warning', delayed: 'error',
};
const LIFECYCLE_STAGES = ['proposed', 'budget-approved', 'procurement', 'contract-awarded', 'work-started', 'in-progress', 'completed', 'inspected', 'closed'];
function stageLabel(stage) { return String(stage || 'planned').split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' '); }
const EXPENDITURE_TYPES = ['Recurrent Expenditure', 'Capital Expenditure', 'Other'];
const PROGRAM_TYPES = ['Infrastructure', 'Maintenance', 'Service Program', 'Social Program', 'Grant Program', 'Other'];

function wardValue(value) {
  return String(value || '').replace(/^Ward\s+/i, '').trim().replace(/^0+(?=\d)/, '');
}
function sameWard(a, b) { return wardValue(a) === wardValue(b); }

function sameName(a, b) { return String(a || '').trim().toLowerCase().replace(/\s+/g, ' ') === String(b || '').trim().toLowerCase().replace(/\s+/g, ' '); }

function provinceBase(value) { return String(value || '').trim().toLowerCase().replace(/\s+province$/, ''); }
function sameProvince(a, b) { return provinceBase(a) === provinceBase(b); }

function flowFor(item) {
  const flow = item.financialFlow || {};
  const revisedBudget = Number(flow.revisedBudget ?? item.revisedBudget ?? item.amount ?? 0) || 0;
  const paidAmount = Number(flow.paidAmount ?? item.paidAmount ?? item.spent ?? 0) || 0;
  return {
    originalApprovedBudget: Number(flow.originalApprovedBudget ?? item.originalApprovedBudget ?? item.amount ?? 0) || 0,
    revisedBudget,
    releasedAmount: Number(flow.releasedAmount ?? item.releasedAmount ?? item.spent ?? 0) || 0,
    contractedAmount: Number(flow.contractedAmount ?? item.contractedAmount ?? 0) || 0,
    paidAmount,
    remainingAmount: Math.max(0, Number(flow.remainingAmount ?? revisedBudget - paidAmount) || 0),
    paidPercent: revisedBudget ? Math.min(100, Math.round((paidAmount / revisedBudget) * 100)) : 0,
  };
}

export default function BudgetPage() {
  const { user } = useAuth();
  const [tracking, setTracking] = useState(null);
  const [items, setItems] = useState([]);
  const [changes, setChanges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [recordQuery, setRecordQuery] = useState('');
  const [recordStatus, setRecordStatus] = useState('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [view, setView] = useState('map');
  const [path, setPath] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detailItem, setDetailItem] = useState(null);
  const [feedbackItem, setFeedbackItem] = useState(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [proposal, setProposal] = useState(emptyProposal);
  const [budgetPage, setBudgetPage] = useState(1);
  const [budgetLimit, setBudgetLimit] = useState(8);
  const [varianceOpen, setVarianceOpen] = useState(false);

  const canPropose = user?.role === 'municipality_head' || user?.role === 'ward_rep';
  const isWardRep = user?.role === 'ward_rep';
  const canApprove = user?.role === 'admin';
  const currentLevel = LEVELS[Math.min(path.length, LEVELS.length - 1)];
  const parent = path[path.length - 1] || null;

  const canManageItem = (item) => {
    if (!canPropose) return false;
    if (user?.role === 'ward_rep') {
      const a = user?.wardRepresentativeApplication || {};
      return sameProvince(item.province || 'Koshi Province', a.province || 'Koshi Province') && sameName(item.district, a.district) && sameName(item.municipality, a.municipality) && sameWard(item.ward, a.ward);
    }
    if (user?.role === 'municipality_head') {
      const a = user?.municipalityHeadProfile || {};
      return sameProvince(item.province || 'Koshi Province', a.province || 'Koshi Province') && sameName(item.district, a.district) && sameName(item.municipality, a.municipality);
    }
    return false;
  };

  const load = () => {
    setLoading(true);
    Promise.all([get('/api/budgets/tracking'), get('/api/budgets?limit=5000')])
      .then(([tree, budget]) => { setTracking(tree); setItems(budget.items || []); })
      .catch(err => toast.error(err.message || 'Could not load budget tracking'))
      .finally(() => setLoading(false));
  };

  const loadChanges = () => {
    if (!user || user.role === 'researcher') return;
    get('/api/budgets/changes?status=all&limit=25').then(d => setChanges(d.changes || [])).catch(() => {});
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { loadChanges(); }, [user?.role]);


  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const qDistrict = params.get('district');
    const qWard = params.get('ward');
    if (qDistrict && qWard) {
      setPath([
        { id: 'deep-link-province', name: params.get('province') || 'Koshi Province' },
        { id: 'deep-link-district', name: qDistrict },
        { id: 'deep-link-municipality', name: params.get('municipality') || '' },
        { id: 'deep-link-ward', name: qWard },
      ]);
    }
  }, []);

  const nodes = useMemo(() => {
    if (!tracking) return [];
    const source = tracking[`${currentLevel}s`] || [];
    const filtered = source.filter(n => !parent || n.parent === parent.name);
    if (!q.trim()) return filtered;
    const re = new RegExp(q.trim(), 'i');
    return filtered.filter(n => re.test(n.name) || re.test(n.parent || ''));
  }, [tracking, currentLevel, parent, q]);

  const total = useMemo(() => {
    const provinces = tracking?.provinces || [];
    return provinces.reduce((acc, n) => ({ allocated: acc.allocated + n.allocated, spent: acc.spent + n.spent, completed: acc.completed + n.completed, remaining: acc.remaining + n.remaining, projectCount: acc.projectCount + n.projectCount, delayed: acc.delayed + (n.delayed || 0) }), { allocated: 0, spent: 0, completed: 0, remaining: 0, projectCount: 0, delayed: 0 });
  }, [tracking]);

  const drill = (node) => {
    if (currentLevel === 'ward') return;
    setPath(prev => [...prev, node]);
    setQ('');
  };

  const jumpTo = (index) => {
    setPath(index < 0 ? [] : path.slice(0, index + 1));
    setQ('');
  };

  const selectItem = (item) => {
    if (!canPropose) return;
    const flow = flowFor(item);
    setCreating(false);
    setSelected(item);
    setProposal({
      title: item.title || '', department: item.department || '', sector: item.sector || '', fiscalYear: item.fiscalYear || '',
      district: item.district || '', municipality: item.municipality || '', ward: item.ward || '', amount: item.amount || '',
      originalApprovedBudget: flow.originalApprovedBudget || '', revisedBudget: flow.revisedBudget || '', releasedAmount: flow.releasedAmount || '',
      contractedAmount: flow.contractedAmount || '', paidAmount: flow.paidAmount || '', expenditureType: item.expenditureType || 'Capital Expenditure',
      programType: item.programType || 'Infrastructure', reason: '',
      status: '', timelineStart: item.timelineStart ? item.timelineStart.slice(0, 10) : '', timelineEnd: item.timelineEnd ? item.timelineEnd.slice(0, 10) : '',
    });
  };

  const startCreate = () => {
    const a = user?.wardRepresentativeApplication || {};
    setSelected(null);
    setCreating(true);
    setProposal(isWardRep ? { ...emptyProposal, province: a.province || 'Koshi Province', district: a.district || '', municipality: a.municipality || '', ward: a.ward || '' } : emptyProposal);
  };

  const buildExportParams = () => {
    const params = new URLSearchParams();
    const [province, district, municipality, ward] = path;
    if (province) params.set('province', province.name);
    if (district) params.set('district', district.name);
    if (municipality?.name) params.set('municipality', municipality.name);
    if (ward) params.set('ward', wardValue(ward.name));
    if (q.trim()) params.set('project', q.trim());
    return params;
  };

  const downloadCsv = async () => {
    try {
      const params = buildExportParams();
      const res = await fetch('/api/budgets/export.csv?' + params.toString(), { headers: { Authorization: `Bearer ${getToken() || ''}` } });
      if (!res.ok) throw new Error('Could not export CSV');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'civicdrishti-budget-export.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Budget CSV downloaded');
    } catch (err) { toast.error(err.message); }
  };


  const submitProposal = async (event) => {
    event.preventDefault();
    if (!selected && !creating) return;
    setSaving(true);
    try {
      if (creating) await post('/api/budgets/changes', proposal);
      else await post(`/api/budgets/${selected._id}/changes`, proposal);
      toast.success(isWardRep ? 'Ward budget edit sent for admin approval' : (creating ? 'New budget record sent for approval' : 'Budget update sent for approval'));
      setCreating(false); setSelected(null); setProposal(emptyProposal); loadChanges(); load();
    } catch (err) { toast.error(err.message); }
    setSaving(false);
  };

  const reviewChange = async (id, status) => {
    try {
      await patch(`/api/budgets/changes/${id}`, { status });
      setChanges(prev => prev.map(c => c._id === id ? { ...c, status } : c));
      toast.success(status === 'approved' ? 'Approved' : 'Rejected');
      load();
    } catch (err) { toast.error(err.message); }
  };

  const filteredItems = useMemo(() => items.filter(item => {
    const [province, district, municipality, ward] = path;
    if (province && !sameProvince(item.province || 'Koshi Province', province.name)) return false;
    if (district && !sameName(item.district, district.name)) return false;
    if (municipality && municipality.name && !sameName(item.municipality, municipality.name)) return false;
    if (ward && !sameWard(item.ward, ward.name)) return false;
    if (recordStatus !== 'all' && (item.status || 'planned') !== recordStatus) return false;
    if (recordQuery.trim()) {
      const needle = recordQuery.trim().toLowerCase();
      const haystack = `${item.title || ''} ${item.department || ''} ${item.sector || ''} ${item.district || ''} ${item.municipality || ''} ${item.ward || ''}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  }), [items, path, recordQuery, recordStatus]);

  const contextSummary = useMemo(() => filteredItems.reduce((acc, item) => {
    const flow = flowFor(item);
    acc.allocated += flow.revisedBudget;
    acc.spent += flow.paidAmount;
    acc.remaining += flow.remainingAmount;
    acc.completed += item.status === 'completed' ? 1 : 0;
    acc.delayed += item.status === 'delayed' ? 1 : 0;
    return acc;
  }, { allocated: 0, spent: 0, remaining: 0, completed: 0, delayed: 0 }), [filteredItems]);

  useEffect(() => { setBudgetPage(1); }, [parent?.name, currentLevel, budgetLimit]);

  const budgetPages = Math.max(1, Math.ceil(filteredItems.length / budgetLimit));
  const safeBudgetPage = Math.min(budgetPage, budgetPages);
  const visibleItems = filteredItems.slice((safeBudgetPage - 1) * budgetLimit, safeBudgetPage * budgetLimit);

  const completionPct = total.allocated ? Math.round((total.spent / total.allocated) * 100) : 0;
  const statCards = [
    { label: 'Allocated', value: formatNPR(total.allocated), support: 'National public allocation', icon: Wallet, tone: 'text-[var(--gov-primary)] bg-[#fff4f3]' },
    { label: 'Spent', value: formatNPR(total.spent), support: `${total.projectCount} public projects`, icon: TrendingUp, tone: 'text-[var(--gov-success)] bg-[#eef8f3]' },
    { label: 'Remaining', value: formatNPR(total.remaining), support: `${total.delayed} delayed projects`, icon: Clock3, tone: 'text-[#8a5a12] bg-[#fff8e8]' },
    { label: 'Completion', value: `${completionPct}%`, support: `${formatNPR(total.completed)} completed value`, icon: PiggyBank, tone: 'text-[var(--gov-info)] bg-[#eef5fb]' },
  ];

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 sm:space-y-8">
      <div className="gov-card p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="gov-label uppercase font-bold">Public budget</h1>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button onClick={downloadCsv} className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--gov-border)] bg-white px-4 text-sm font-medium text-[var(--gov-text)] transition hover:bg-[var(--gov-surface-soft)]"><Download className="h-4 w-4" />Export CSV</button>

            {canPropose && <button onClick={startCreate} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--gov-primary)] px-4 text-sm font-medium text-white transition hover:bg-[var(--gov-primary-dark)]">Add budget record</button>}
          </div>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.label} className="gov-card p-3.5 sm:p-5">
              <div className="flex items-start justify-between gap-2 sm:gap-4">
                <div>
                  <p className="gov-label uppercase" style={{ fontWeight: 700 }}>{card.label}</p>
                </div>
                <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg sm:h-9 sm:w-9', card.tone)}><Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" /></span>
              </div>
              {loading ? <div className="shimmer mt-3 h-6 w-24 rounded-lg bg-[#edf2f7] sm:mt-5 sm:h-8 sm:w-28" /> : <p className="gov-stat mt-3 font-normal sm:mt-5">{card.value}</p>}
            </article>
          );
        })}
      </section>

      <CommunityFeedbackBoard />

      <div className="gov-card overflow-hidden">
        <button type="button" onClick={() => setVarianceOpen(v => !v)} className="flex w-full flex-col gap-3 p-5 text-left sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#fff4f3] text-[var(--gov-primary)]"><AlertTriangle className="h-4 w-4" /></span>
            <div>
              <h2 className="gov-h3 font-bold">Budget variance alerts</h2>
            </div>
          </div>
          <span className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-[var(--gov-border)] px-3 text-xs font-medium text-[var(--gov-text)] hover:bg-[var(--gov-surface-soft)]">{varianceOpen ? 'Hide alerts' : 'Show alerts'}</span>
        </button>
        {varianceOpen && <div className="border-t border-[var(--gov-border)] p-5"><VarianceAlerts items={items} loading={loading} /></div>}
      </div>

      <div className="gov-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--gov-border)] p-5">
          <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-[var(--gov-muted)]">
            <button onClick={() => jumpTo(-1)} className={cn('rounded-md px-2 py-1', path.length === 0 ? 'bg-[#fff4f3] text-[var(--gov-primary)]' : 'hover:bg-[var(--gov-surface-soft)]')}>Provinces</button>
            {path.map((p, i) => p.name ? <span key={p.id} className="flex items-center gap-2"><ChevronRight className="h-4 w-4 text-[var(--gov-subtle)]" /><button onClick={() => jumpTo(i)} className="rounded-md px-2 py-1 hover:bg-[var(--gov-surface-soft)]">{p.name}</button></span> : null)}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--gov-subtle)]" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder={`Search ${LEVEL_LABEL[currentLevel].toLowerCase()}`} className="h-10 w-56 rounded-lg border border-[var(--gov-border)] pl-9 pr-3 text-sm outline-none focus:border-[var(--gov-primary)]" />
            </div>
            <Tab active={view === 'map'} onClick={() => setView('map')} icon={Map}>Map</Tab>
            <Tab active={view === 'list'} onClick={() => setView('list')} icon={ListTree}>List</Tab>
          </div>
        </div>

        <div className="p-5">
          {loading ? <div className="grid gap-3 md:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="shimmer h-36 rounded-lg bg-[#edf2f7]" />)}</div> : view === 'map' ? <MapView nodes={nodes} level={currentLevel} onDrill={drill} /> : <ListView nodes={nodes} level={currentLevel} onDrill={drill} />}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="gov-card overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-[var(--gov-border)] px-5 py-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="gov-h3">Projects in this area</h2>
              <span className="shrink-0 rounded-full bg-[#fff4f3] px-2.5 py-1 text-xs font-medium text-[var(--gov-primary)]">{filteredItems.length} records</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <CompactStat label="Allocated" value={formatNPR(contextSummary.allocated)} />
              <CompactStat label="Spent" value={formatNPR(contextSummary.spent)} />
              <CompactStat label="Completed / delayed" value={`${contextSummary.completed} / ${contextSummary.delayed}`} />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--gov-subtle)]" /><input value={recordQuery} onChange={e => setRecordQuery(e.target.value)} placeholder="Search projects, department, or place" className="h-10 w-full rounded-lg border border-[var(--gov-border)] pl-9 pr-3 text-sm outline-none focus:border-[var(--gov-primary)]" /></div>
              <button type="button" onClick={() => setFiltersOpen(v => !v)} className={cn('flex h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium sm:w-auto', filtersOpen || recordStatus !== 'all' ? 'border-[var(--gov-primary)] bg-[#fff4f3] text-[var(--gov-primary)]' : 'border-[var(--gov-border)] text-[var(--gov-muted)]')}><SlidersHorizontal className="h-4 w-4" />Filters{recordStatus !== 'all' ? ' · 1' : ''}</button>
            </div>
            {filtersOpen && <div className="grid gap-2 rounded-lg bg-[var(--gov-surface-soft)] p-3 sm:grid-cols-[minmax(0,220px)_auto] sm:items-end"><label className="block"><span className="gov-label mb-1 block uppercase">Project status</span><select value={recordStatus} onChange={e => setRecordStatus(e.target.value)} className="h-10 w-full rounded-lg border border-[var(--gov-border)] bg-white px-3 text-sm outline-none focus:border-[var(--gov-primary)]"><option value="all">All statuses</option>{LIFECYCLE_STAGES.map(status => <option key={status} value={status}>{stageLabel(status)}</option>)}</select></label>{(recordStatus !== 'all' || recordQuery) && <button type="button" onClick={() => { setRecordStatus('all'); setRecordQuery(''); }} className="h-10 rounded-lg px-3 text-sm font-medium text-[var(--gov-primary)] hover:bg-[#fff4f3]">Clear filters</button>}</div>}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="bg-[var(--gov-surface-soft)]"><tr className="border-b border-[var(--gov-border)] text-left text-xs font-medium uppercase tracking-wide text-[var(--gov-muted)]"><th className="px-5 py-3 font-medium">Project / Program</th><th className="px-5 py-3 font-medium">Area</th><th className="px-5 py-3 font-medium">Type</th><th className="px-5 py-3 font-medium">Status</th><th className="px-5 py-3 text-right font-medium">Budget progress</th><th className="px-5 py-3 text-right font-medium">Action</th></tr></thead>
              <tbody className="divide-y divide-[var(--gov-border)]">
                {visibleItems.length === 0 ? <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-[var(--gov-subtle)]"><Table2 className="mx-auto mb-2 h-7 w-7 text-[var(--gov-bluegray)]" />No budget records match this view.</td></tr> : visibleItems.map(item => <BudgetRow key={item._id} item={item} canPropose={canPropose} canEdit={canManageItem(item)} onEdit={selectItem} onDetails={setDetailItem} onFeedback={setFeedbackItem} />)}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-[var(--gov-border)] md:hidden">
            {visibleItems.length === 0 ? <div className="px-5 py-10 text-center text-sm text-[var(--gov-subtle)]"><Table2 className="mx-auto mb-2 h-7 w-7 text-[var(--gov-bluegray)]" />No budget records match this view.</div> : visibleItems.map(item => <BudgetMobileCard key={item._id} item={item} canPropose={canPropose} canEdit={canManageItem(item)} onEdit={selectItem} onDetails={setDetailItem} onFeedback={setFeedbackItem} />)}
          </div>
          <div className="border-t border-[var(--gov-border)] p-4">
            <Pagination page={safeBudgetPage} limit={budgetLimit} total={filteredItems.length} onPageChange={setBudgetPage} onLimitChange={setBudgetLimit} pageSizeOptions={[8, 16, 32, 64]} label="budget records" />
          </div>
        </div>

        <aside className="space-y-6">
          {canPropose && <ProposalForm creating={creating} selected={selected} proposal={proposal} setProposal={setProposal} submitProposal={submitProposal} saving={saving} cancel={() => { setCreating(false); setSelected(null); }} />}
          {feedbackItem && <FeedbackPanel item={feedbackItem} onClose={() => setFeedbackItem(null)} />}
          {(canApprove || canPropose) && <Approvals changes={changes} canApprove={canApprove} reviewChange={reviewChange} />}
        </aside>
      </div>
      {detailItem && <ProjectDetailsModal item={detailItem} onClose={() => setDetailItem(null)} onFeedback={() => { setDetailItem(null); setFeedbackItem(detailItem); }} />}
    </div>
  );
}

const ALERT_META = {
  overspending: { label: 'Overspending', tone: 'error', icon: TrendingUp },
  underutilized: { label: 'Underutilized', tone: 'info', icon: TrendingDown },
  needsAttention: { label: 'Needs attention', tone: 'warning', icon: AlertTriangle },
  onTrack: { label: 'On track', tone: 'success', icon: CheckCircle2 },
};

function completionPercentForItem(item) {
  const manual = Number(item.completionOverride ?? item.manualCompletionPercent ?? item.progressPercent);
  if (Number.isFinite(manual)) return Math.max(0, Math.min(100, manual));
  const stage = String(item.status || 'planned').toLowerCase();
  const mapped = { planned: 10, pending: 15, ongoing: 55, active: 60, completed: 100, resolved: 100, delayed: 35 };
  return mapped[stage] ?? 25;
}

function computeVarianceAlert(item, thresholds) {
  const flow = flowFor(item);
  const effectiveBudget = flow.revisedBudget;
  const spent = flow.paidAmount;
  const variance = spent - effectiveBudget;
  const variancePercent = effectiveBudget ? Math.round((variance / effectiveBudget) * 1000) / 10 : 0;
  const financialProgress = flow.paidPercent;
  const physicalProgress = completionPercentForItem(item);
  const progressGap = Math.round((financialProgress - physicalProgress) * 10) / 10;
  let alert = 'onTrack';
  if (variancePercent > thresholds.overspend) alert = 'overspending';
  else if (variancePercent < -thresholds.underutilize && physicalProgress < 60) alert = 'underutilized';
  else if (Math.abs(progressGap) > thresholds.mismatch) alert = 'needsAttention';
  return { effectiveBudget, spent, remaining: flow.remainingAmount, variance, variancePercent, financialProgress, physicalProgress, progressGap, alert };
}

function VarianceAlerts({ items, loading }) {
  const [projectQuery, setProjectQuery] = useState('');
  const [alertFilter, setAlertFilter] = useState('all');
  const [thresholds, setThresholds] = useState({ overspend: 5, underutilize: 35, mismatch: 30 });
  const rows = useMemo(() => items.map(item => ({ item, metrics: computeVarianceAlert(item, thresholds) })).filter(row => {
    if (alertFilter !== 'all' && row.metrics.alert !== alertFilter) return false;
    const needle = projectQuery.trim().toLowerCase();
    if (!needle) return true;
    const item = row.item;
    const haystack = ((item.title || '') + ' ' + (item.department || '') + ' ' + (item.sector || '') + ' ' + (item.district || '') + ' ' + (item.municipality || '') + ' ' + (item.ward || '')).toLowerCase();
    return haystack.includes(needle);
  }).sort((a, b) => Math.abs(b.metrics.progressGap) - Math.abs(a.metrics.progressGap)), [items, thresholds, projectQuery, alertFilter]);
  const summary = rows.reduce((acc, row) => { acc[row.metrics.alert] = (acc[row.metrics.alert] || 0) + 1; return acc; }, {});

  return <div className="space-y-4">
    <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
      {Object.entries(ALERT_META).map(([key, meta]) => { const Icon = meta.icon; return <button key={key} type="button" onClick={() => setAlertFilter(alertFilter === key ? 'all' : key)} className={cn('min-w-0 rounded-lg border p-2.5 text-left ring-1 ring-inset transition-colors sm:p-3', alertFilter === key ? TONE[meta.tone] : 'border-[var(--gov-border)] bg-[var(--gov-surface-soft)] text-[var(--gov-muted)] ring-transparent hover:bg-white')}> <span className="flex items-center gap-1.5 text-[11px] font-medium sm:gap-2 sm:text-xs"><Icon className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{meta.label}</span></span><span className="mt-1.5 block text-lg font-semibold tabular-nums text-[var(--gov-text)] sm:mt-2 sm:text-xl">{summary[key] || 0}</span></button>; })}
    </div>
    <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto]">
      <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--gov-subtle)]" /><input value={projectQuery} onChange={e => setProjectQuery(e.target.value)} placeholder="Search variance alerts" className="h-10 w-full rounded-lg border border-[var(--gov-border)] pl-9 pr-3 text-sm outline-none focus:border-[var(--gov-primary)]" /></div>
      <div className="grid gap-2 sm:grid-cols-3">
        <ThresholdInput label="Overspend %" value={thresholds.overspend} onChange={value => setThresholds(prev => ({ ...prev, overspend: value }))} />
        <ThresholdInput label="Underuse %" value={thresholds.underutilize} onChange={value => setThresholds(prev => ({ ...prev, underutilize: value }))} />
        <ThresholdInput label="Gap %" value={thresholds.mismatch} onChange={value => setThresholds(prev => ({ ...prev, mismatch: value }))} />
      </div>
    </div>
    <div className="overflow-hidden rounded-lg border border-[var(--gov-border)]">
      <div className="hidden grid-cols-[minmax(220px,1fr)_130px_130px_130px_140px] gap-3 border-b border-[var(--gov-border)] bg-[var(--gov-surface-soft)] px-4 py-2 text-xs font-medium uppercase tracking-wide text-[var(--gov-muted)] md:grid"><span>Project</span><span>Budget</span><span>Spent</span><span>Progress gap</span><span>Alert</span></div>
      {loading ? <div className="p-4 text-sm text-[var(--gov-muted)]">Checking budget variance...</div> : rows.length === 0 ? <div className="p-5 text-center text-sm text-[var(--gov-muted)]">No variance alerts match these filters.</div> : <div className="divide-y divide-[var(--gov-border)]">{rows.slice(0, 8).map(({ item, metrics }) => { const meta = ALERT_META[metrics.alert] || ALERT_META.onTrack; const Icon = meta.icon; return <div key={item._id || item.id || item.title} className="grid gap-3 px-4 py-3 text-sm md:grid-cols-[minmax(220px,1fr)_130px_130px_130px_140px] md:items-center"><div><p className="font-medium text-[var(--gov-text)]">{item.title || 'Untitled project'}</p><p className="mt-0.5 text-xs text-[var(--gov-muted)]">{item.district || 'District'} · {item.municipality || 'Municipality'} · Ward {item.ward || 'N/A'}</p></div><div><p className="text-xs text-[var(--gov-subtle)] md:hidden">Budget</p><p className="tabular-nums text-[var(--gov-text)]">{formatNPR(metrics.effectiveBudget)}</p></div><div><p className="text-xs text-[var(--gov-subtle)] md:hidden">Spent</p><p className="tabular-nums text-[var(--gov-text)]">{formatNPR(metrics.spent)}</p></div><div><p className="text-xs text-[var(--gov-subtle)] md:hidden">Progress gap</p><p className="tabular-nums text-[var(--gov-text)]">{metrics.progressGap > 0 ? '+' : ''}{metrics.progressGap}%</p><p className="text-[11px] text-[var(--gov-muted)]">Money {metrics.financialProgress}% · Work {metrics.physicalProgress}%</p></div><span className={cn('inline-flex w-fit items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium ring-1 ring-inset', TONE[meta.tone])}><Icon className="h-3.5 w-3.5" />{meta.label}</span></div>; })}</div>}
    </div>
  </div>;
}

function ThresholdInput({ label, value, onChange }) {
  return <label className="flex h-10 items-center gap-2 rounded-lg border border-[var(--gov-border)] bg-white px-3 text-xs text-[var(--gov-muted)]"><span className="whitespace-nowrap">{label}</span><input type="number" min="0" max="100" value={value} onChange={e => onChange(Number(e.target.value) || 0)} className="min-w-0 flex-1 bg-transparent text-right text-sm text-[var(--gov-text)] outline-none" /></label>;
}

function CompactStat({ label, value }) { return <div className="min-w-0 rounded-lg border border-[var(--gov-border)] bg-[var(--gov-surface-soft)] px-2 py-2 sm:px-3"><p className="gov-label truncate uppercase">{label}</p><p className="mt-0.5 truncate text-xs font-medium tabular-nums text-[var(--gov-text)] sm:text-sm">{value}</p></div>; }
function Tab({ active, onClick, icon: Icon, children }) {
  return <button onClick={onClick} className={cn('flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors', active ? 'bg-[var(--gov-primary)] text-white' : 'border border-[var(--gov-border)] text-[var(--gov-muted)] hover:bg-[var(--gov-surface-soft)]')}><Icon className="h-4 w-4" />{children}</button>;
}
function StageBadge({ stage }) {
  return <span className={cn('gov-badge ring-1 ring-inset uppercase tracking-wide', TONE[STAGE_TONE[stage] || 'neutral'])}>{stageLabel(stage)}</span>;
}
function Progress({ node }) {
  return <div><div className="mb-1 flex justify-between gap-1 text-[10px] font-medium text-[var(--gov-muted)] sm:text-xs"><span className="truncate">{node.completion}%<span className="hidden sm:inline"> complete</span></span><span className="truncate">{formatNPR(node.spent)}<span className="hidden sm:inline"> spent</span></span></div><div className="h-1.5 overflow-hidden rounded-full bg-[#edf2f7] sm:h-2"><div className="h-full rounded-full bg-[var(--gov-primary)]" style={{ width: `${Math.min(100, node.completion)}%` }} /></div></div>;
}
function MapView({ nodes, level, onDrill }) {
  return <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-2 xl:grid-cols-3">{nodes.map((n, i) => <button key={n.id} onClick={() => onDrill(n)} className="min-w-0 rounded-lg border border-[var(--gov-border)] bg-white p-2.5 text-left transition hover:-translate-y-0.5 hover:border-[var(--gov-primary)] hover:shadow-md sm:p-3.5 sm:min-h-40 sm:p-5"><div className="flex items-start justify-between gap-1.5"><div className="min-w-0"><p className="gov-label truncate uppercase">{LEVEL_LABEL[level]}</p><h3 className="gov-h3 mt-1 truncate text-sm sm:text-base">{n.name}</h3></div><span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-[var(--gov-surface-soft)] text-[11px] text-[var(--gov-subtle)] sm:h-7 sm:w-7 sm:text-xs">{i + 1}</span></div><p className="gov-label mt-2 uppercase sm:mt-3 sm:mt-5">Allocated</p><p className="mt-0.5 truncate text-base font-semibold tracking-tight text-[var(--gov-text)] sm:text-xl sm:text-[26px]">{formatNPR(n.allocated)}</p><div className="mt-2 sm:mt-3 sm:mt-4"><Progress node={n} /></div><div className="mt-2 flex flex-wrap items-center gap-1.5 sm:mt-2.5 sm:gap-2 sm:mt-3"><span className="gov-badge bg-[#fff4f3] text-[var(--gov-primary)]">{n.projectCount}<span className="hidden sm:inline"> records</span></span><span className="text-[10px] text-[var(--gov-subtle)] sm:text-[11px]">{n.delayed} delayed</span></div></button>)}</div>;
}
function ListView({ nodes, level, onDrill }) {
  return <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-[var(--gov-surface-soft)]"><tr className="border-b border-[var(--gov-border)] text-left text-xs font-medium uppercase tracking-wide text-[var(--gov-muted)]"><th className="px-3 py-3">{LEVEL_LABEL[level]}</th><th className="px-3 py-3 text-right">Allocated</th><th className="px-3 py-3 text-right">Spent</th><th className="px-3 py-3">Completion</th><th className="px-3 py-3">Stages</th></tr></thead><tbody className="divide-y divide-[var(--gov-border)]">{nodes.map(n => <tr key={n.id} onClick={() => onDrill(n)} className="cursor-pointer hover:bg-[var(--gov-surface-soft)]"><td className="px-3 py-3.5 font-medium text-[var(--gov-text)]">{n.name}</td><td className="px-3 py-3.5 text-right text-[15px] font-medium text-[var(--gov-text)]">{formatNPR(n.allocated)}</td><td className="px-3 py-3.5 text-right text-[15px] font-medium text-[var(--gov-text)]">{formatNPR(n.spent)}</td><td className="min-w-56 px-3 py-3.5"><Progress node={n} /></td><td className="px-3 py-3.5 text-xs text-[var(--gov-subtle)]">{n.planned} planned / {n.ongoing} ongoing / {n.completedStage} done / {n.delayed} delayed</td></tr>)}</tbody></table></div>;
}
function BudgetRow({ item, canPropose, canEdit, onEdit, onDetails, onFeedback }) {
  const flow = flowFor(item);
  return <tr className="align-top hover:bg-[var(--gov-surface-soft)]"><td className="px-5 py-4"><div className="flex flex-wrap items-center gap-2"><p className="font-medium text-[var(--gov-text)]">{item.title}</p>{(item.isDemo || item.demoLabel) && <span className="gov-badge bg-[#fff8e8] text-[#8a5a12]">{item.demoLabel || 'Demo Data'}</span>}</div><p className="mt-0.5 text-xs text-[var(--gov-subtle)]">{item.department || item.sector || 'Public project'}</p></td><td className="px-5 py-4 text-xs text-[var(--gov-muted)]">{item.district || '—'}<br />{item.municipality || '—'}{item.ward ? ` · Ward ${item.ward}` : ''}</td><td className="px-5 py-4 text-xs text-[var(--gov-muted)]"><p>{item.programType || item.sector || '—'}</p><p className="mt-1 text-[var(--gov-subtle)]">{item.fiscalYear || 'Current fiscal year'}</p></td><td className="px-5 py-4"><StageBadge stage={item.status || 'planned'} /></td><td className="min-w-52 px-5 py-4"><div className="flex items-end justify-between gap-2"><div><p className="gov-label uppercase">Allocated</p><p className="mt-0.5 text-sm font-medium tabular-nums text-[var(--gov-text)]">{formatNPR(flow.revisedBudget)}</p></div><p className="text-xs font-medium text-[var(--gov-success)]">{flow.paidPercent}% spent</p></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#edf2f7]"><div className="h-full rounded-full bg-[var(--gov-primary)]" style={{ width: `${flow.paidPercent}%` }} /></div><p className="mt-1 text-[11px] text-[var(--gov-subtle)]">{formatNPR(flow.paidAmount)} spent</p></td><td className="px-5 py-4 text-right"><div className="flex justify-end gap-2"><button onClick={() => onDetails(item)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--gov-border)] px-3 text-xs font-medium text-[var(--gov-text)] hover:bg-white"><Eye className="h-3.5 w-3.5" />View project</button><button onClick={() => onFeedback(item)} className="h-9 rounded-lg border border-[var(--gov-border)] px-3 text-xs font-medium text-[var(--gov-text)] hover:bg-white">Feedback</button>{canPropose && <button disabled={!canEdit} onClick={() => onEdit(item)} className="h-9 rounded-lg border border-[var(--gov-border)] px-3 text-xs font-medium text-[var(--gov-text)] hover:bg-white disabled:cursor-not-allowed disabled:opacity-40">Edit</button>}</div></td></tr>;
}
function BudgetMobileCard({ item, canPropose, canEdit, onEdit, onDetails, onFeedback }) {
  const flow = flowFor(item);
  return <div className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-medium text-[var(--gov-text)]">{item.title}</h3>{(item.isDemo || item.demoLabel) && <span className="gov-badge bg-[#fff8e8] text-[#8a5a12]">{item.demoLabel || 'Demo Data'}</span>}</div><p className="mt-1 text-xs text-[var(--gov-muted)]">{item.district || '—'} · {item.municipality || '—'}{item.ward ? ` · Ward ${item.ward}` : ''}</p></div><StageBadge stage={item.status || 'planned'} /></div><div className="mt-3 rounded-lg bg-[var(--gov-surface-soft)] p-3"><div className="flex items-end justify-between gap-2"><div><p className="gov-label uppercase">Allocated</p><p className="mt-0.5 text-sm font-medium tabular-nums text-[var(--gov-text)]">{formatNPR(flow.revisedBudget)}</p></div><p className="text-xs font-medium text-[var(--gov-success)]">{flow.paidPercent}% spent</p></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#edf2f7]"><div className="h-full rounded-full bg-[var(--gov-primary)]" style={{ width: `${flow.paidPercent}%` }} /></div></div><div className="mt-3 grid grid-cols-2 gap-2"><button onClick={() => onDetails(item)} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-[var(--gov-border)] text-xs font-medium text-[var(--gov-text)]"><Eye className="h-3.5 w-3.5" />View project</button><button onClick={() => onFeedback(item)} className="h-10 rounded-lg border border-[var(--gov-border)] text-xs font-medium text-[var(--gov-text)]">Feedback</button>{canPropose && <button disabled={!canEdit} onClick={() => onEdit(item)} className="col-span-2 h-10 rounded-lg border border-[var(--gov-border)] text-xs font-medium text-[var(--gov-text)] disabled:cursor-not-allowed disabled:opacity-40">Propose edit</button>}</div>{canPropose && !canEdit && <p className="mt-2 text-[11px] text-[var(--gov-subtle)]">Management locked outside your assigned jurisdiction.</p>}</div>;
}

function stageIndex(status) {
  const i = LIFECYCLE_STAGES.indexOf(status);
  if (i >= 0) return i;
  if (status === 'planned') return 0;
  if (status === 'ongoing' || status === 'delayed') return LIFECYCLE_STAGES.indexOf('in-progress');
  return 0;
}
function LifecycleSection({ item }) {
  const current = stageIndex(item.status);
  const history = item.statusHistory || [];
  const hasTimeline = item.timelineStart || item.timelineEnd;
  const docs = item.evidenceDocuments || [];
  return <div>
    <h3 className="gov-h3">Project lifecycle</h3>
    <p className="gov-secondary mt-1">Tracks the project from proposal through closure.</p>
    <div className="mt-3 flex flex-wrap gap-1.5">
      {LIFECYCLE_STAGES.map((stage, i) => (
        <span key={stage} className={cn('rounded-md px-2 py-1 text-[10px] font-medium', i < current ? 'bg-[#eef8f3] text-[var(--gov-success)]' : i === current ? 'bg-[var(--gov-primary)] text-white' : 'bg-[var(--gov-surface-soft)] text-[var(--gov-subtle)]')}>
          {stageLabel(stage)}
        </span>
      ))}
    </div>
    {(item.responsibleAuthority || hasTimeline) && (
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {item.responsibleAuthority && <FlowCell label="Responsible dept" value={item.responsibleAuthority} isText />}
        {item.timelineStart && <FlowCell label="Started" value={new Date(item.timelineStart).toLocaleDateString()} isText />}
        {item.timelineEnd && <FlowCell label="Target completion" value={new Date(item.timelineEnd).toLocaleDateString()} isText />}
      </div>
    )}
    {docs.length > 0 && (
      <div className="mt-3">
        <p className="gov-label uppercase">Documents</p>
        <ul className="mt-1.5 space-y-1">
          {docs.map((d, i) => <li key={i}><a href={d.url} target="_blank" rel="noreferrer" className="text-xs font-medium text-[var(--gov-primary)] underline underline-offset-2 hover:text-[var(--gov-primary-dark)]">{d.title || `Document ${i + 1}`}</a></li>)}
        </ul>
      </div>
    )}
    {history.length > 0 && (
      <div className="mt-3">
        <p className="gov-label uppercase">Stage history</p>
        <ul className="mt-1.5 space-y-2">
          {[...history].reverse().map((h, i) => (
            <li key={h._id || i} className="flex items-start justify-between gap-3 text-xs">
              <span className="font-medium text-[var(--gov-text)]">{stageLabel(h.stage)}</span>
              <span className="shrink-0 text-[var(--gov-subtle)]">{h.changedAt ? new Date(h.changedAt).toLocaleDateString() : ''}</span>
            </li>
          ))}
        </ul>
      </div>
    )}
  </div>;
}
function ProjectDetailsModal({ item, onClose, onFeedback }) {
  const flow = flowFor(item);
  return <div className="fixed inset-0 z-50 flex items-end bg-black/35 sm:items-center sm:justify-center sm:p-4" onClick={onClose}><div role="dialog" aria-modal="true" aria-label="Project details" onClick={e => e.stopPropagation()} className="max-h-[92vh] w-full overflow-y-auto rounded-t-xl bg-white shadow-xl sm:max-w-2xl sm:rounded-xl"><div className="sticky top-0 flex items-start justify-between gap-3 border-b border-[var(--gov-border)] bg-white px-4 py-4 sm:px-6"><div className="min-w-0"><p className="gov-label uppercase">Public project details</p><h2 className="gov-h3 mt-1">{item.title}</h2><p className="gov-secondary mt-1">{[item.province, item.district, item.municipality, item.ward && `Ward ${item.ward}`].filter(Boolean).join(' → ')}</p></div><button type="button" onClick={onClose} className="shrink-0 rounded-lg p-2 text-[var(--gov-subtle)] hover:bg-[var(--gov-surface-soft)]" aria-label="Close project details"><X className="h-4 w-4" /></button></div><div className="space-y-5 p-4 sm:p-6"><div className="flex flex-wrap items-center gap-2"><StageBadge stage={item.status || 'planned'} /><span className="gov-badge bg-[#fff4f3] text-[var(--gov-primary)]">{item.programType || item.sector || 'Public program'}</span><span className="text-xs text-[var(--gov-muted)]">{item.department || 'Department not specified'} · {item.fiscalYear || 'Current fiscal year'}</span></div><div className="rounded-lg border border-[var(--gov-border)] bg-[var(--gov-surface-soft)] p-4"><div className="flex items-center justify-between gap-3"><div><p className="gov-secondary">Delivery progress</p><p className="mt-1 text-xl font-semibold tabular-nums text-[var(--gov-text)]">{flow.paidPercent}% spent</p></div><p className="text-right text-xs text-[var(--gov-muted)]">{formatNPR(flow.paidAmount)} paid<br />of {formatNPR(flow.revisedBudget)}</p></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-[#edf2f7]"><div className="h-full rounded-full bg-[var(--gov-primary)]" style={{ width: `${flow.paidPercent}%` }} /></div></div><div><h3 className="gov-h3">Financial record</h3><p className="gov-secondary mt-1">Detailed amounts are shown here to keep the public register easy to scan.</p><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3"><FlowCell label="Original approval" value={flow.originalApprovedBudget} /><FlowCell label="Revised budget" value={flow.revisedBudget} /><FlowCell label="Released" value={flow.releasedAmount} /><FlowCell label="Contracted" value={flow.contractedAmount} /><FlowCell label="Paid" value={flow.paidAmount} accent /><FlowCell label="Remaining" value={flow.remainingAmount} /></div></div><LifecycleSection item={item} /><div className="flex flex-col-reverse gap-2 border-t border-[var(--gov-border)] pt-4 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} className="h-10 rounded-lg border border-[var(--gov-border)] px-4 text-sm font-medium text-[var(--gov-muted)]">Close</button><button type="button" onClick={onFeedback} className="h-10 rounded-lg bg-[var(--gov-primary)] px-4 text-sm font-medium text-white hover:bg-[var(--gov-primary-dark)]">Give community feedback</button></div></div></div></div>;
}

const VERDICTS = [
  { value: 'yes', label: 'Yes', helper: 'Work looks useful', icon: ThumbsUp, tone: 'success', dot: 'bg-[var(--gov-success)]' },
  { value: 'partially', label: 'Partly', helper: 'Some concerns', icon: MessageSquare, tone: 'warning', dot: 'bg-[#b7791f]' },
  { value: 'no', label: 'No', helper: 'Concern remains', icon: ThumbsDown, tone: 'error', dot: 'bg-[var(--gov-error)]' },
];
function verdictMeta(v) { return VERDICTS.find(x => x.value === v) || VERDICTS[0]; }

function feedbackToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read the photo'));
    reader.readAsDataURL(file);
  });
}

function FeedbackSummary({ stats }) {
  const total = stats.total || 0;
  if (!total) return <p className="mb-4 rounded-lg bg-[var(--gov-surface-soft)] p-3 text-xs text-[var(--gov-muted)]">No community feedback yet — be the first to respond.</p>;
  return (
    <div className="mb-4 rounded-lg border border-[var(--gov-border)] bg-[var(--gov-surface-soft)] p-3">
      <div className="flex items-center justify-between">
        <p className="gov-label uppercase">Community verdict</p>
        <p className="text-xs font-semibold text-[var(--gov-text)]">{total} response{total === 1 ? '' : 's'}</p>
      </div>
      <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-[#edf2f7]">
        {VERDICTS.map(v => {
          const pct = total ? Math.round(((stats[v.value] || 0) / total) * 100) : 0;
          if (!pct) return null;
          return <div key={v.value} className={cn('h-full', v.dot)} style={{ width: `${pct}%` }} title={`${v.label} ${pct}%`} />;
        })}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[11px]">
        {VERDICTS.map(v => {
          const count = stats[v.value] || 0;
          const pct = total ? Math.round((count / total) * 100) : 0;
          return (
            <div key={v.value} className="rounded-md bg-white p-1.5">
              <p className="font-semibold text-[var(--gov-text)]">{pct}%</p>
              <p className="text-[var(--gov-subtle)]">{v.label} ({count})</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FeedbackEntry({ row }) {
  const meta = verdictMeta(row.verdict);
  const Icon = meta.icon;
  const displayName = row.user?.name?.trim() || 'Anonymous Citizen';
  return (
    <div className="rounded-lg border border-[var(--gov-border)] bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#fff4f3] text-[10px] font-semibold text-[var(--gov-primary)]">{initials(displayName) || <User className="h-3.5 w-3.5" />}</span>
          <div>
            <p className="text-xs font-semibold text-[var(--gov-text)]">{displayName}{row.isDemo ? <span className="ml-1 font-normal text-[var(--gov-subtle)]">· Demo feedback</span> : null}</p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[var(--gov-subtle)]">
              {row.user?.ward && <span className="flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" />Ward {row.user.ward}</span>}
              <span>{relativeTime(row.createdAt)}</span>
            </div>
          </div>
        </div>
        <span className={cn('flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset', TONE[meta.tone])}>
          <Icon className="h-3 w-3" />{meta.label}
        </span>
      </div>
      {row.comment && <p className="mt-2 text-xs leading-relaxed text-[var(--gov-muted)]">{row.comment}</p>}
      {row.photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={row.photo} alt="Citizen submitted evidence" className="mt-2 h-28 w-full rounded-lg border border-[var(--gov-border)] object-cover" />
      )}
    </div>
  );
}

function FeedbackPanel({ item, onClose }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [verdict, setVerdict] = useState('yes');
  const [comment, setComment] = useState('');
  const [photo, setPhoto] = useState(null);
  const [photoError, setPhotoError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const ward = user?.civicLocation?.ward || '';

  const load = () => get(`/api/budgets/${item._id}/feedback?limit=3`).then(setData).catch(() => setData({ stats: { total: 0 }, feedback: [] }));
  useEffect(() => { if (item?._id) load(); /* eslint-disable-next-line */ }, [item?._id]);

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setPhotoError('Please upload an image'); return; }
    if (file.size > 5 * 1024 * 1024) { setPhotoError('Photo must be under 5MB'); return; }
    setPhotoError('');
    try { setPhoto({ name: file.name, dataUrl: await feedbackToDataUrl(file) }); }
    catch { setPhotoError('Could not read that photo'); }
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await post(`/api/budgets/${item._id}/feedback`, { verdict, comment, photo: photo?.dataUrl || '', photoName: photo?.name || '' });
      toast.success('Community feedback submitted');
      await load();
      setComment('');
      setPhoto(null);
    } catch (err) { toast.error(err.message); }
    setSaving(false);
  };

  const stats = data?.stats || { total: 0 };


  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 xl:static xl:z-auto xl:block xl:bg-transparent" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="gov-card max-h-[88vh] w-full overflow-y-auto rounded-t-2xl p-5 shadow-xl xl:max-h-none xl:overflow-visible xl:rounded-xl xl:shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="gov-label uppercase">Community feedback</p>
          <h2 className="gov-h3 mt-0.5">{item.title}</h2>
        </div>
        <button onClick={onClose} className="rounded-md p-1.5 text-[var(--gov-subtle)] hover:bg-[var(--gov-surface-soft)]"><X className="h-4 w-4" /></button>
      </div>

      <FeedbackSummary stats={stats} />

      <form onSubmit={submit} className="space-y-2.5">
        <div className="grid grid-cols-3 gap-2">
          {VERDICTS.map(v => {
            const Icon = v.icon;
            const active = verdict === v.value;
            return (
              <button key={v.value} type="button" onClick={() => setVerdict(v.value)} className={cn('flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-[11px] font-semibold ring-1 ring-inset transition-colors', active ? TONE[v.tone] : 'border-[var(--gov-border)] text-[var(--gov-muted)] ring-transparent hover:bg-[var(--gov-surface-soft)]')}>
                <Icon className="h-4 w-4" />{v.label}
              </button>
            );
          })}
        </div>

        <p className="flex items-center gap-1 text-[11px] text-[var(--gov-subtle)]"><MapPin className="h-3 w-3" />Posting as your registered ward{ward ? ` — Ward ${ward}` : ' (not set on your profile)'}</p>

        <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Optional public comment" maxLength={1000} className="min-h-20 w-full rounded-lg border border-[var(--gov-border)] px-3 py-2 text-sm outline-none focus:border-[var(--gov-primary)]" />

        <div className="flex items-center gap-2">
          <label className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--gov-border)] px-3 text-xs font-medium text-[var(--gov-text)] hover:bg-[var(--gov-surface-soft)]">
            Attach photo (optional)
            <input type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
          </label>
          {photo && <span className="flex items-center gap-1 text-[11px] text-[var(--gov-muted)]">{photo.name}<button type="button" onClick={() => setPhoto(null)} className="text-[var(--gov-subtle)] hover:text-[var(--gov-primary)]"><X className="h-3 w-3" /></button></span>}
        </div>
        {photoError && <p className="text-[11px] text-[var(--gov-error)]">{photoError}</p>}

        <button disabled={saving} className="h-10 w-full rounded-lg bg-[var(--gov-primary)] text-sm font-medium text-white hover:bg-[var(--gov-primary-dark)] disabled:opacity-50">
          {saving ? 'Submitting...' : 'Submit feedback'}
        </button>
      </form>

      {(data?.feedback || []).length > 0 && (
        <div className="mt-4 border-t border-[var(--gov-border)] pt-3">
          <p className="gov-label mb-2 uppercase">Recent feedback</p>
          <div className="space-y-2">{(data?.feedback || []).map(row => <FeedbackEntry key={row._id} row={row} />)}</div>
        </div>
      )}

      {stats.total > 0 && (
        <button onClick={() => setShowAll(true)} className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg border border-[var(--gov-border)] py-2.5 text-xs font-medium text-[var(--gov-text)] hover:bg-[var(--gov-surface-soft)]">
          View all feedback <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}

      {showAll && <FeedbackHistoryModal item={item} onClose={() => setShowAll(false)} />}
      </div>
    </div>
  );
}

function FeedbackHistoryModal({ item, onClose }) {
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState({ total: 0 });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    get(`/api/budgets/${item._id}/feedback?page=${page}&limit=${limit}`)
      .then(r => { setRows(r.feedback || []); setStats(r.stats || { total: 0 }); setTotal(r.total || 0); })
      .catch(() => toast.error('Failed to load feedback history'))
      .finally(() => setLoading(false));
  }, [item._id, page, limit]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="gov-card flex max-h-[85vh] w-full max-w-lg flex-col shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--gov-border)] px-5 py-4">
          <div>
            <h3 className="gov-h3">All community feedback</h3>
            <p className="gov-secondary mt-0.5">{item.title}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-[var(--gov-subtle)] hover:bg-[var(--gov-surface-soft)]"><X className="h-4 w-4" /></button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          <FeedbackSummary stats={stats} />
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="shimmer h-20 rounded-lg bg-[#edf2f7]" />)}</div>
          ) : rows.length === 0 ? (
            <p className="rounded-lg bg-[var(--gov-surface-soft)] p-4 text-center text-xs text-[var(--gov-muted)]">No feedback yet.</p>
          ) : (
            <div className="space-y-2">{rows.map(row => <FeedbackEntry key={row._id} row={row} />)}</div>
          )}
        </div>

        <div className="border-t border-[var(--gov-border)] p-3">
          <Pagination page={page} limit={limit} total={total} onPageChange={setPage} onLimitChange={setLimit} pageSizeOptions={[10, 20, 50]} label="feedback entries" />
        </div>
      </div>
    </div>
  );
}

function FlowCell({ label, value, accent, isText }) {
  return <div className="rounded-md border border-[var(--gov-border)] bg-[var(--gov-surface-soft)] px-2 py-1.5"><p className="gov-label uppercase">{label}</p><p className={cn('mt-0.5 font-medium tabular-nums', accent ? 'text-[var(--gov-primary)]' : 'text-[var(--gov-text)]')}>{isText ? value : formatNPR(value)}</p></div>;
}
function ProposalForm({ creating, selected, proposal, setProposal, submitProposal, saving, cancel }) {
  const enabled = creating || selected;
  const update = (key, value) => setProposal(p => ({ ...p, [key]: value }));
  const fields = [
    ['title', 'Project / program title'],
    ['department', 'Responsible department'],
    ['sector', 'Budget sector'],
    ['fiscalYear', 'Fiscal year'],
    ['district', 'District'],
    ['municipality', 'Municipality / local level'],
    ['ward', 'Ward number'],
  ];
  const moneyFields = [
    ['amount', 'Allocated budget'],
    ['originalApprovedBudget', 'Original approved budget'],
    ['revisedBudget', 'Revised budget'],
    ['releasedAmount', 'Released / disbursed amount'],
    ['contractedAmount', 'Contracted amount'],
    ['paidAmount', 'Actual utilized / paid amount'],
  ];

  return (
    <form onSubmit={submitProposal} className="gov-card p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="gov-h3 mt-1">{creating ? 'Add budget record' : selected ? 'Propose budget edit' : 'Official budget workspace'}</h2>
        </div>
        {enabled && <button type="button" onClick={cancel} className="rounded-md p-1.5 text-[var(--gov-subtle)] hover:bg-[var(--gov-surface-soft)]" aria-label="Close budget form"><X className="h-4 w-4" /></button>}
      </div>

      <fieldset disabled={!enabled} className="space-y-4 disabled:opacity-60">
        <section>
          <h3 className="mb-2 text-sm font-semibold text-[var(--gov-text)]">Project information</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.slice(0, 4).map(([key, label, placeholder]) => (
              <label key={key} className="block">
                <span className="mb-1 block text-xs font-medium text-[var(--gov-muted)]">{label}</span>
                <input value={proposal[key]} onChange={e => update(key, e.target.value)} placeholder={placeholder} className="h-11 w-full rounded-lg border border-[var(--gov-border)] px-3 text-sm outline-none focus:border-[var(--gov-primary)]" />
              </label>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-[var(--gov-text)]">Location</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {fields.slice(4).map(([key, label, placeholder]) => (
              <label key={key} className="block">
                <span className="mb-1 block text-xs font-medium text-[var(--gov-muted)]">{label}</span>
                <input value={proposal[key]} onChange={e => update(key, e.target.value)} placeholder={placeholder} className="h-11 w-full rounded-lg border border-[var(--gov-border)] px-3 text-sm outline-none focus:border-[var(--gov-primary)]" />
              </label>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-[var(--gov-text)]">Budget details</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--gov-muted)]">Expenditure type</span>
              <select value={proposal.expenditureType} onChange={e => update('expenditureType', e.target.value)} className="h-11 w-full rounded-lg border border-[var(--gov-border)] px-3 text-sm outline-none focus:border-[var(--gov-primary)]">{EXPENDITURE_TYPES.map(v => <option key={v}>{v}</option>)}</select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--gov-muted)]">Program type</span>
              <select value={proposal.programType} onChange={e => update('programType', e.target.value)} className="h-11 w-full rounded-lg border border-[var(--gov-border)] px-3 text-sm outline-none focus:border-[var(--gov-primary)]">{PROGRAM_TYPES.map(v => <option key={v}>{v}</option>)}</select>
            </label>
            {moneyFields.map(([key, label]) => (
              <label key={key} className="block">
                <span className="mb-1 block text-xs font-medium text-[var(--gov-muted)]">{label}</span>
                <input type="number" min="0" value={proposal[key]} onChange={e => update(key, e.target.value)} className="h-11 w-full rounded-lg border border-[var(--gov-border)] px-3 text-sm outline-none focus:border-[var(--gov-primary)]" />
              </label>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-[var(--gov-text)]">Project stage</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--gov-muted)]">Lifecycle stage</span>
              <select value={proposal.status || ''} onChange={e => update('status', e.target.value)} className="h-11 w-full rounded-lg border border-[var(--gov-border)] px-3 text-sm outline-none focus:border-[var(--gov-primary)]">
                <option value="">Keep current stage</option>
                {LIFECYCLE_STAGES.map(v => <option key={v} value={v}>{stageLabel(v)}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--gov-muted)]">Work started</span>
              <input type="date" value={proposal.timelineStart || ''} onChange={e => update('timelineStart', e.target.value)} className="h-11 w-full rounded-lg border border-[var(--gov-border)] px-3 text-sm outline-none focus:border-[var(--gov-primary)]" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--gov-muted)]">Target completion</span>
              <input type="date" value={proposal.timelineEnd || ''} onChange={e => update('timelineEnd', e.target.value)} className="h-11 w-full rounded-lg border border-[var(--gov-border)] px-3 text-sm outline-none focus:border-[var(--gov-primary)]" />
            </label>
          </div>
        </section>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-[var(--gov-muted)]">Reason for change</span>
          <textarea value={proposal.reason} onChange={e => update('reason', e.target.value)} placeholder="Explain why this budget record or revision is needed" className="min-h-24 w-full rounded-lg border border-[var(--gov-border)] px-3 py-2 text-sm leading-6 outline-none focus:border-[var(--gov-primary)]" />
        </label>
      </fieldset>

      <button disabled={!enabled || saving} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--gov-primary)] text-sm font-medium text-white transition hover:bg-[var(--gov-primary-dark)] disabled:opacity-50"><Send className="h-4 w-4" />{saving ? 'Submitting...' : 'Submit for approval'}</button>
    </form>
  );
}
function Approvals({ changes, canApprove, reviewChange }) {
  const pending = changes.filter(change => change.status === 'pending');
  const visible = canApprove ? pending : changes.slice(0, 5);
  return <div className="gov-card">
    <div className="flex items-center justify-between border-b border-[var(--gov-border)] px-5 py-4">
      <div>
        <h2 className="gov-h3">{canApprove ? 'Admin approvals' : 'Recent proposals'}</h2>
        <p className="gov-secondary mt-0.5">{canApprove ? `${pending.length} awaiting review` : 'Latest budget workflow updates'}</p>
      </div>
      {pending.length > 0 && <span className="gov-badge bg-[#fff8e8] text-[#8a5a12]">{pending.length} pending</span>}
    </div>
    <div className="divide-y divide-[var(--gov-border)]">
      {visible.length === 0 ? <p className="px-5 py-7 text-center text-sm text-[var(--gov-subtle)]">{canApprove ? 'No approvals are waiting.' : 'No budget change history yet.'}</p> : visible.map(change => (
        <div key={change._id} className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[var(--gov-text)]">{change.budgetItem?.title || change.proposed?.title || 'New budget record'}</p>
              {change.requestedBy?.name && <p className="mt-0.5 text-xs text-[var(--gov-muted)]">Requested by {change.requestedBy.name}</p>}
            </div>
            <span className={cn('shrink-0 gov-badge uppercase tracking-wide ring-1 ring-inset', change.status === 'approved' ? TONE.success : change.status === 'rejected' ? TONE.error : TONE.warning)}>{change.status}</span>
          </div>
          {change.reason && <p className="mt-2 line-clamp-2 text-xs text-[var(--gov-muted)]">{change.reason}</p>}
          {canApprove && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => reviewChange(change._id, 'approved')} className="flex h-9 items-center justify-center gap-1 rounded-lg bg-[var(--gov-success)] text-xs font-medium text-white hover:opacity-90"><Check className="h-3.5 w-3.5" />Approve</button>
              <button onClick={() => reviewChange(change._id, 'rejected')} className="h-9 rounded-lg bg-[var(--gov-error)] text-xs font-medium text-white hover:opacity-90">Reject</button>
            </div>
          )}
        </div>
      ))}
    </div>
    {canApprove && changes.length > visible.length && <p className="border-t border-[var(--gov-border)] px-5 py-2.5 text-center text-xs text-[var(--gov-muted)]">Only pending requests are shown here.</p>}
  </div>;
}