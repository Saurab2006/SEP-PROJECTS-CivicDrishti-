'use client';
import { useEffect, useMemo, useState } from 'react';
import { get, patch, post, getToken } from '@/lib/api';
import { formatNPR, cn, relativeTime, initials } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';
import { AlertTriangle, Check, CheckCircle2, ChevronRight, Download, Eye, FileText, ListTree, Map, MapPin, MessageSquare, Search, Send, SlidersHorizontal, Table2, ThumbsDown, ThumbsUp, TrendingDown, TrendingUp, User, X } from 'lucide-react';
import { toast } from 'sonner';
import Pagination from '@/components/Pagination';
import CommunityFeedbackBoard from '@/components/CommunityFeedbackBoard';

const emptyProposal = {
  title: '', department: '', sector: '', fiscalYear: '', district: '', municipality: '', ward: '',
  amount: '', originalApprovedBudget: '', revisedBudget: '', releasedAmount: '', contractedAmount: '', paidAmount: '',
  expenditureType: 'Capital Expenditure', programType: 'Infrastructure', reason: '',
};
const LEVELS = ['province', 'district', 'municipality', 'ward'];
const LEVEL_LABEL = { province: 'Province', district: 'District', municipality: 'Municipality', ward: 'Ward' };
const STAGE_COLORS = { planned: 'bg-slate-100 text-slate-700', ongoing: 'bg-blue-50 text-blue-700', completed: 'bg-emerald-50 text-emerald-700', delayed: 'bg-red-50 text-red-700' };
const EXPENDITURE_TYPES = ['Recurrent Expenditure', 'Capital Expenditure', 'Other'];
const PROGRAM_TYPES = ['Infrastructure', 'Maintenance', 'Service Program', 'Social Program', 'Grant Program', 'Other'];

function wardValue(value) {
  return String(value || '').replace(/^Ward\s+/i, '').trim().replace(/^0+(?=\d)/, '');
}
function sameWard(a, b) { return wardValue(a) === wardValue(b); }

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
      return (item.province || 'Koshi Province') === (a.province || 'Koshi Province') && item.district === a.district && item.municipality === a.municipality && sameWard(item.ward, a.ward);
    }
    if (user?.role === 'municipality_head') {
      const a = user?.municipalityHeadProfile || {};
      return (item.province || 'Koshi Province') === (a.province || 'Koshi Province') && item.district === a.district && item.municipality === a.municipality;
    }
    return false;
  };

  const load = () => {
    setLoading(true);
    Promise.all([get('/api/budgets/tracking'), get('/api/budgets?limit=500')])
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
    });
  };

  const startCreate = () => {
    const a = user?.wardRepresentativeApplication || {};
    setSelected(null);
    setCreating(true);
    setProposal(isWardRep ? { ...emptyProposal, district: a.district || '', municipality: a.municipality || '', ward: a.ward || '' } : emptyProposal);
  };

  const buildExportParams = () => {
    const params = new URLSearchParams();
    const [province, district, municipality, ward] = path;
    if (province) params.set('province', province.name);
    if (district) params.set('district', district.name);
    if (municipality) params.set('municipality', municipality.name);
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


  const downloadPdf = async () => {
    try {
      const params = buildExportParams();
      const res = await fetch('/api/budgets/export.json?' + params.toString(), { headers: { Authorization: 'Bearer ' + (getToken() || '') } });
      if (!res.ok) throw new Error('Could not fetch export data');
      const { items: rows, totals, generatedAt } = await res.json();
      const htmlRows = rows.map(r => '<tr><td>' + (r.title || '') + '</td><td>' + (r.department || '') + '</td><td>' + (r.district || '') + '</td><td>' + (r.municipality || '') + '</td><td>' + (r.ward || '') + '</td><td>' + (r.fiscalYear || '') + '</td><td>' + formatNPR(r.allocated) + '</td><td>' + formatNPR(r.spent) + '</td><td>' + formatNPR(r.remaining) + '</td><td>' + r.utilization + '%</td><td>' + (r.status || '') + '</td></tr>').join('');
      const report = '<!doctype html><html><head><title>Civicdrishti Budget Report</title><style>body{font-family:Arial,sans-serif;margin:24px;color:#102a2b}h1{font-size:20px;margin:0 0 6px}p{margin:4px 0;color:#50616f}table{width:100%;border-collapse:collapse;margin-top:16px;font-size:11px}th,td{border:1px solid #d8e0e8;padding:6px;text-align:left;vertical-align:top}th{background:#0f3d3e;color:white}.totals{display:flex;gap:12px;margin-top:14px}.totals div{border:1px solid #d8e0e8;border-radius:8px;padding:8px 12px}@media print{button{display:none}}</style></head><body><button onclick="window.print()">Save / Print PDF</button><h1>Civicdrishti - Public Budget Transparency</h1><p>Generated: ' + new Date(generatedAt).toLocaleString() + '</p><div class="totals"><div>Allocated: ' + formatNPR(totals.allocated) + '</div><div>Spent: ' + formatNPR(totals.spent) + '</div><div>Remaining: ' + formatNPR(totals.remaining) + '</div></div><table><thead><tr><th>Project</th><th>Department</th><th>District</th><th>Municipality</th><th>Ward</th><th>FY</th><th>Allocated</th><th>Spent</th><th>Remaining</th><th>Util %</th><th>Status</th></tr></thead><tbody>' + htmlRows + '</tbody></table><script>setTimeout(function(){window.print()},300)<\/script></body></html>';
      const win = window.open('', '_blank');
      if (!win) throw new Error('Popup blocked. Allow popups to export PDF.');
      win.document.write(report);
      win.document.close();
      toast.success('PDF report opened');
    } catch (err) { toast.error(err.message || 'Could not generate PDF'); }
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
    if (province && (item.province || 'Koshi Province') !== province.name) return false;
    if (district && item.district !== district.name) return false;
    if (municipality && item.municipality !== municipality.name) return false;
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

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#dc143c]">Civicदृष्टि public budget register</p>
          <h1 className="mt-1 text-2xl font-medium text-[#102a2b]">Province to Ward Budget Tracking</h1>
          <p className="mt-1 text-sm text-[#65706c]">{isWardRep ? `You can propose updates only for ${user?.wardRepresentativeApplication?.district || 'your district'}, ${user?.wardRepresentativeApplication?.municipality || 'your municipality'}, Ward ${user?.wardRepresentativeApplication?.ward || ''}.` : `Browse public allocations, releases, payments, and completion from Nepal's 7 provinces down to districts, municipalities, and wards.`}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={downloadCsv} className="flex h-10 items-center gap-2 rounded-lg border border-[#ded6c8] bg-white px-4 text-sm font-medium text-[#0f3d3e] hover:bg-[#fffaf2]"><Download className="h-4 w-4" />Export CSV</button>
          <button onClick={downloadPdf} className="flex h-10 items-center gap-2 rounded-lg border border-[#ded6c8] bg-white px-4 text-sm font-medium text-[#0f3d3e] hover:bg-[#fffaf2]"><FileText className="h-4 w-4" />PDF</button>
          {canPropose && <button onClick={startCreate} className="h-10 rounded-lg bg-[#dc143c] px-4 text-sm font-medium text-white hover:bg-[#b80f31]">Add budget record</button>}
        </div>
      </div>

      <div className="rounded-lg border border-[#d8e0e8] bg-[#f8fbfd] px-4 py-3 text-sm text-[#405467]">
        All citizens can browse budget records across Nepal. Creating or editing records is restricted to approved municipality heads and ward representatives, and every change requires admin approval before becoming public.
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Allocated" value={formatNPR(total.allocated)} helper="National public allocation" />
        <Metric label="Spent" value={formatNPR(total.spent)} helper={`${total.projectCount} public projects`} />
        <Metric label="Remaining" value={formatNPR(total.remaining)} helper={`${total.delayed} delayed projects`} />
        <Metric label="Completion" value={total.allocated ? `${Math.round((total.spent / total.allocated) * 100)}%` : '0%'} helper={`${total.completed ? formatNPR(total.completed) : 'No'} completed value`} />
      </div>

      <CommunityFeedbackBoard />

      <div className="rounded-lg border border-[#ded6c8] bg-white shadow-sm">
        <button type="button" onClick={() => setVarianceOpen(v => !v)} className="flex w-full flex-col gap-3 p-4 text-left sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#dc143c]">Budget Variance Alerts</p>
            <h2 className="mt-1 text-sm font-medium text-[#102a2b]">Spot overspending, underuse, and spending-progress mismatch</h2>
            <p className="mt-1 text-xs text-[#65706c]">Calculated from allocated budget, paid amount, project stage, and completion override when available.</p>
          </div>
          <span className="inline-flex h-9 items-center justify-center rounded-lg border border-[#ded6c8] px-3 text-xs font-medium text-[#0f3d3e] hover:bg-[#eef6f4]">{varianceOpen ? 'Hide alerts' : 'Show alerts'}</span>
        </button>
        {varianceOpen && <div className="border-t border-[#eee6d8] p-4"><VarianceAlerts items={items} loading={loading} /></div>}
      </div>

      <div className="rounded-lg border border-[#ded6c8] bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eee6d8] p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-[#65706c]">
            <button onClick={() => jumpTo(-1)} className={cn('rounded-md px-2 py-1', path.length === 0 ? 'bg-[#eef6f4] text-[#0f3d3e]' : 'hover:bg-[#f7f2ea]')}>Provinces</button>
            {path.map((p, i) => <span key={p.id} className="flex items-center gap-2"><ChevronRight className="h-4 w-4 text-[#b8ad9b]" /><button onClick={() => jumpTo(i)} className="rounded-md px-2 py-1 hover:bg-[#f7f2ea]">{p.name}</button></span>)}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8c8272]" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder={`Search ${LEVEL_LABEL[currentLevel].toLowerCase()}`} className="h-10 w-56 rounded-lg border border-[#ded6c8] pl-9 pr-3 text-sm outline-none focus:border-[#0f3d3e]" />
            </div>
            <Tab active={view === 'map'} onClick={() => setView('map')} icon={Map}>Map</Tab>
            <Tab active={view === 'list'} onClick={() => setView('list')} icon={ListTree}>List</Tab>
          </div>
        </div>

        <div className="p-4">
          {loading ? <div className="grid gap-3 md:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="shimmer h-36 rounded-lg" />)}</div> : view === 'map' ? <MapView nodes={nodes} level={currentLevel} onDrill={drill} /> : <ListView nodes={nodes} level={currentLevel} onDrill={drill} />}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="rounded-lg border border-[#ded6c8] bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[#eee6d8] px-4 py-4 sm:px-5">
            <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium text-[#102a2b]">Projects in this area</h2>
              <p className="mt-0.5 text-xs text-[#65706c]">Key amounts and delivery status first. Open a project for the full financial record.</p>
            </div>
            <span className="shrink-0 rounded-full bg-[#eef6f4] px-2.5 py-1 text-xs font-medium text-[#0f3d3e]">{filteredItems.length} records</span>
            </div>
            <div className="grid gap-2 text-xs text-[#65706c] sm:grid-cols-3">
              <CompactStat label="Allocated" value={formatNPR(contextSummary.allocated)} />
              <CompactStat label="Spent" value={formatNPR(contextSummary.spent)} />
              <CompactStat label="Completed / delayed" value={`${contextSummary.completed} / ${contextSummary.delayed}`} />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8c8272]" /><input value={recordQuery} onChange={e => setRecordQuery(e.target.value)} placeholder="Search projects, department, or place" className="h-10 w-full rounded-lg border border-[#ded6c8] pl-9 pr-3 text-sm outline-none focus:border-[#0f3d3e]" /></div>
              <button type="button" onClick={() => setFiltersOpen(v => !v)} className={cn('flex h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium sm:w-auto', filtersOpen || recordStatus !== 'all' ? 'border-[#0f3d3e] bg-[#eef6f4] text-[#0f3d3e]' : 'border-[#ded6c8] text-[#65706c]')}><SlidersHorizontal className="h-4 w-4" />Filters{recordStatus !== 'all' ? ' · 1' : ''}</button>
            </div>
            {filtersOpen && <div className="grid gap-2 rounded-lg bg-[#f8fbfd] p-3 sm:grid-cols-[minmax(0,220px)_auto] sm:items-end"><label className="block"><span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[#8c8272]">Project status</span><select value={recordStatus} onChange={e => setRecordStatus(e.target.value)} className="h-10 w-full rounded-lg border border-[#ded6c8] px-3 text-sm outline-none focus:border-[#0f3d3e]"><option value="all">All statuses</option>{Object.keys(STAGE_COLORS).map(status => <option key={status} value={status}>{status[0].toUpperCase() + status.slice(1)}</option>)}</select></label>{(recordStatus !== 'all' || recordQuery) && <button type="button" onClick={() => { setRecordStatus('all'); setRecordQuery(''); }} className="h-10 rounded-lg px-3 text-sm font-medium text-[#dc143c] hover:bg-[#fff4f3]">Clear filters</button>}</div>}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead><tr className="border-b-2 border-[#102a2b] text-left text-[11px] text-[#8c8272]"><th className="px-5 py-3 font-normal">Project / Program</th><th className="px-5 py-3 font-normal">Area</th><th className="px-5 py-3 font-normal">Type</th><th className="px-5 py-3 font-normal">Status</th><th className="px-5 py-3 text-right font-normal">Budget progress</th><th className="px-5 py-3 text-right font-normal">Action</th></tr></thead>
              <tbody className="divide-y divide-[#f2ede4]">
                {visibleItems.length === 0 ? <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-[#8c8272]"><Table2 className="mx-auto mb-2 h-7 w-7 text-[#cfc4b4]" />No budget records match this view.</td></tr> : visibleItems.map(item => <BudgetRow key={item._id} item={item} canPropose={canPropose} canEdit={canManageItem(item)} onEdit={selectItem} onDetails={setDetailItem} onFeedback={setFeedbackItem} />)}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-[#f2ede4] md:hidden">
            {visibleItems.length === 0 ? <div className="px-5 py-10 text-center text-sm text-[#8c8272]"><Table2 className="mx-auto mb-2 h-7 w-7 text-[#cfc4b4]" />No budget records match this view.</div> : visibleItems.map(item => <BudgetMobileCard key={item._id} item={item} canPropose={canPropose} canEdit={canManageItem(item)} onEdit={selectItem} onDetails={setDetailItem} onFeedback={setFeedbackItem} />)}
          </div>
          <div className="border-t border-[#eee6d8] p-4">
            <Pagination page={safeBudgetPage} limit={budgetLimit} total={filteredItems.length} onPageChange={setBudgetPage} onLimitChange={setBudgetLimit} pageSizeOptions={[8, 16, 32, 64]} label="budget records" />
          </div>
        </div>

        <aside className="space-y-5">
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
  overspending: { label: 'Overspending', tone: 'border-red-200 bg-red-50 text-red-700', icon: TrendingUp },
  underutilized: { label: 'Underutilized', tone: 'border-blue-200 bg-blue-50 text-blue-700', icon: TrendingDown },
  needsAttention: { label: 'Needs attention', tone: 'border-amber-200 bg-amber-50 text-amber-700', icon: AlertTriangle },
  onTrack: { label: 'On track', tone: 'border-emerald-200 bg-emerald-50 text-emerald-700', icon: CheckCircle2 },
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
    <div className="grid gap-3 md:grid-cols-4">
      {Object.entries(ALERT_META).map(([key, meta]) => { const Icon = meta.icon; return <button key={key} type="button" onClick={() => setAlertFilter(alertFilter === key ? 'all' : key)} className={cn('rounded-lg border p-3 text-left transition-colors', alertFilter === key ? meta.tone : 'border-[#ded6c8] bg-[#fbfcfd] text-[#65706c] hover:bg-[#fffaf2]')}> <span className="flex items-center gap-2 text-xs font-medium"><Icon className="h-3.5 w-3.5" />{meta.label}</span><span className="mt-2 block text-xl font-medium tabular-nums text-[#102a2b]">{summary[key] || 0}</span></button>; })}
    </div>
    <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto]">
      <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8c8272]" /><input value={projectQuery} onChange={e => setProjectQuery(e.target.value)} placeholder="Search variance alerts" className="h-10 w-full rounded-lg border border-[#ded6c8] pl-9 pr-3 text-sm outline-none focus:border-[#0f3d3e]" /></div>
      <div className="grid gap-2 sm:grid-cols-3">
        <ThresholdInput label="Overspend %" value={thresholds.overspend} onChange={value => setThresholds(prev => ({ ...prev, overspend: value }))} />
        <ThresholdInput label="Underuse %" value={thresholds.underutilize} onChange={value => setThresholds(prev => ({ ...prev, underutilize: value }))} />
        <ThresholdInput label="Gap %" value={thresholds.mismatch} onChange={value => setThresholds(prev => ({ ...prev, mismatch: value }))} />
      </div>
    </div>
    <div className="overflow-hidden rounded-lg border border-[#ded6c8]">
      <div className="hidden grid-cols-[minmax(220px,1fr)_130px_130px_130px_140px] gap-3 border-b border-[#eee6d8] bg-[#fbfcfd] px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-[#65706c] md:grid"><span>Project</span><span>Budget</span><span>Spent</span><span>Progress gap</span><span>Alert</span></div>
      {loading ? <div className="p-4 text-sm text-[#65706c]">Checking budget variance...</div> : rows.length === 0 ? <div className="p-5 text-center text-sm text-[#65706c]">No variance alerts match these filters.</div> : <div className="divide-y divide-[#f2ede4]">{rows.slice(0, 8).map(({ item, metrics }) => { const meta = ALERT_META[metrics.alert] || ALERT_META.onTrack; const Icon = meta.icon; return <div key={item._id || item.id || item.title} className="grid gap-3 px-4 py-3 text-sm md:grid-cols-[minmax(220px,1fr)_130px_130px_130px_140px] md:items-center"><div><p className="font-medium text-[#102a2b]">{item.title || 'Untitled project'}</p><p className="mt-0.5 text-xs text-[#65706c]">{item.district || 'District'} � {item.municipality || 'Municipality'} � Ward {item.ward || 'N/A'}</p></div><div><p className="text-xs text-[#8c8272] md:hidden">Budget</p><p className="tabular-nums text-[#102a2b]">{formatNPR(metrics.effectiveBudget)}</p></div><div><p className="text-xs text-[#8c8272] md:hidden">Spent</p><p className="tabular-nums text-[#102a2b]">{formatNPR(metrics.spent)}</p></div><div><p className="text-xs text-[#8c8272] md:hidden">Progress gap</p><p className="tabular-nums text-[#102a2b]">{metrics.progressGap > 0 ? '+' : ''}{metrics.progressGap}%</p><p className="text-[11px] text-[#65706c]">Money {metrics.financialProgress}% � Work {metrics.physicalProgress}%</p></div><span className={cn('inline-flex w-fit items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium', meta.tone)}><Icon className="h-3.5 w-3.5" />{meta.label}</span></div>; })}</div>}
    </div>
  </div>;
}

function ThresholdInput({ label, value, onChange }) {
  return <label className="flex h-10 items-center gap-2 rounded-lg border border-[#ded6c8] bg-white px-3 text-xs text-[#65706c]"><span className="whitespace-nowrap">{label}</span><input type="number" min="0" max="100" value={value} onChange={e => onChange(Number(e.target.value) || 0)} className="min-w-0 flex-1 bg-transparent text-right text-sm text-[#102a2b] outline-none" /></label>;
}

function Metric({ label, value, helper }) {
  return <div className="rounded-lg border border-[#ded6c8] bg-white p-4 shadow-sm"><p className="text-[11px] font-medium uppercase tracking-wide text-[#8c8272]">{label}</p><p className="mt-1 text-[26px] font-medium tracking-tight tabular-nums text-[#0f6e56]">{value}</p><p className="mt-1 text-xs text-[#65706c]">{helper}</p></div>;
}
function CompactStat({ label, value }) { return <div className="rounded-md border border-[#e2e8ee] bg-white px-3 py-2"><p className="text-[10px] uppercase tracking-wide text-[#8c8272]">{label}</p><p className="mt-0.5 font-medium tabular-nums text-[#102a2b]">{value}</p></div>; }
function Tab({ active, onClick, icon: Icon, children }) {
  return <button onClick={onClick} className={cn('flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium', active ? 'bg-[#0f3d3e] text-white' : 'border border-[#ded6c8] text-[#65706c] hover:bg-[#f7f2ea]')}><Icon className="h-4 w-4" />{children}</button>;
}
function StageBadge({ stage }) {
  return <span className={cn('rounded-md px-2 py-1 text-[10px] font-medium uppercase tracking-wide', STAGE_COLORS[stage] || STAGE_COLORS.planned)}>{stage}</span>;
}
function Progress({ node }) {
  return <div><div className="mb-1 flex justify-between text-xs font-medium text-[#65706c]"><span>{node.completion}% complete</span><span>{formatNPR(node.spent)} spent</span></div><div className="h-2 overflow-hidden rounded-full bg-[#eee6d8]"><div className="h-full rounded-full bg-[#0f3d3e]" style={{ width: `${Math.min(100, node.completion)}%` }} /></div></div>;
}
function MapView({ nodes, level, onDrill }) {
  return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{nodes.map((n, i) => <button key={n.id} onClick={() => onDrill(n)} className="min-h-40 rounded-lg border border-[#ded6c8] bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-[#0f3d3e] hover:shadow-md"><div className="flex items-start justify-between"><div><p className="text-[11px] text-[#8c8272]">{LEVEL_LABEL[level]}</p><h3 className="mt-1 text-[17px] font-medium text-[#102a2b]">{n.name}</h3></div><span className="grid h-7 w-7 place-items-center rounded-md bg-[#f7f2ea] text-[11px] text-[#8c8272]">{i + 1}</span></div><p className="mt-5 text-[11px] text-[#8c8272]">Allocated</p><p className="mt-0.5 text-[26px] font-medium tracking-tight text-[#0f6e56]">{formatNPR(n.allocated)}</p><div className="mt-4"><Progress node={n} /></div><div className="mt-3 flex flex-wrap items-center gap-2"><span className="rounded-md bg-[#eef6f4] px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-[#0f3d3e]">{n.projectCount} records</span><span className="text-[11px] text-[#8c8272]">{n.delayed} delayed</span></div></button>)}</div>;
}
function ListView({ nodes, level, onDrill }) {
  return <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b-2 border-[#102a2b] text-left text-[11px] text-[#8c8272]"><th className="px-3 py-3">{LEVEL_LABEL[level]}</th><th className="px-3 py-3 text-right">Allocated</th><th className="px-3 py-3 text-right">Spent</th><th className="px-3 py-3">Completion</th><th className="px-3 py-3">Stages</th></tr></thead><tbody className="divide-y divide-[#f2ede4]">{nodes.map(n => <tr key={n.id} onClick={() => onDrill(n)} className="cursor-pointer hover:bg-[#fffaf2]"><td className="px-3 py-3.5 font-medium text-[#102a2b]">{n.name}</td><td className="px-3 py-3.5 text-right text-[15px] font-medium text-[#0f6e56]">{formatNPR(n.allocated)}</td><td className="px-3 py-3.5 text-right text-[15px] font-medium text-[#0f6e56]">{formatNPR(n.spent)}</td><td className="min-w-56 px-3 py-3.5"><Progress node={n} /></td><td className="px-3 py-3.5 text-xs text-[#8c8272]">{n.planned} planned / {n.ongoing} ongoing / {n.completedStage} done / {n.delayed} delayed</td></tr>)}</tbody></table></div>;
}
function BudgetRow({ item, canPropose, canEdit, onEdit, onDetails, onFeedback }) {
  const flow = flowFor(item);
  return <tr className="align-top hover:bg-[#fffaf2]"><td className="px-5 py-4"><div className="flex flex-wrap items-center gap-2"><p className="font-medium text-[#102a2b]">{item.title}</p>{(item.isDemo || item.demoLabel) && <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700">{item.demoLabel || 'Demo Data'}</span>}</div><p className="mt-0.5 text-xs text-[#8c8272]">{item.department || item.sector || 'Public project'}</p></td><td className="px-5 py-4 text-xs text-[#65706c]">{item.district || '—'}<br />{item.municipality || '—'}{item.ward ? ` · Ward ${item.ward}` : ''}</td><td className="px-5 py-4 text-xs text-[#65706c]"><p>{item.programType || item.sector || '—'}</p><p className="mt-1 text-[#8c8272]">{item.fiscalYear || 'Current fiscal year'}</p></td><td className="px-5 py-4"><StageBadge stage={item.status || 'planned'} /></td><td className="min-w-52 px-5 py-4"><div className="flex items-end justify-between gap-2"><div><p className="text-[10px] uppercase tracking-wide text-[#8c8272]">Allocated</p><p className="mt-0.5 text-sm font-medium tabular-nums text-[#102a2b]">{formatNPR(flow.revisedBudget)}</p></div><p className="text-xs font-medium text-[#0f6e56]">{flow.paidPercent}% spent</p></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e7edf3]"><div className="h-full rounded-full bg-[#0f3d3e]" style={{ width: `${flow.paidPercent}%` }} /></div><p className="mt-1 text-[11px] text-[#8c8272]">{formatNPR(flow.paidAmount)} spent</p></td><td className="px-5 py-4 text-right"><div className="flex justify-end gap-2"><button onClick={() => onDetails(item)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#ded6c8] px-3 text-xs font-medium text-[#0f3d3e] hover:bg-[#eef6f4]"><Eye className="h-3.5 w-3.5" />View project</button><button onClick={() => onFeedback(item)} className="h-9 rounded-lg border border-[#ded6c8] px-3 text-xs font-medium text-[#0f3d3e] hover:bg-[#eef6f4]">Feedback</button>{canPropose && <button disabled={!canEdit} onClick={() => onEdit(item)} className="h-9 rounded-lg border border-[#ded6c8] px-3 text-xs font-medium text-[#0f3d3e] hover:bg-[#eef6f4] disabled:cursor-not-allowed disabled:opacity-40">Edit</button>}</div></td></tr>;
}
function BudgetMobileCard({ item, canPropose, canEdit, onEdit, onDetails, onFeedback }) {
  const flow = flowFor(item);
  return <div className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-medium text-[#102a2b]">{item.title}</h3>{(item.isDemo || item.demoLabel) && <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700">{item.demoLabel || 'Demo Data'}</span>}</div><p className="mt-1 text-xs text-[#65706c]">{item.district || '—'} · {item.municipality || '—'}{item.ward ? ` · Ward ${item.ward}` : ''}</p></div><StageBadge stage={item.status || 'planned'} /></div><div className="mt-3 rounded-lg bg-[#f8fbfd] p-3"><div className="flex items-end justify-between gap-2"><div><p className="text-[10px] uppercase tracking-wide text-[#8c8272]">Allocated</p><p className="mt-0.5 text-sm font-medium tabular-nums text-[#102a2b]">{formatNPR(flow.revisedBudget)}</p></div><p className="text-xs font-medium text-[#0f6e56]">{flow.paidPercent}% spent</p></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e7edf3]"><div className="h-full rounded-full bg-[#0f3d3e]" style={{ width: `${flow.paidPercent}%` }} /></div></div><div className="mt-3 grid grid-cols-2 gap-2"><button onClick={() => onDetails(item)} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-[#ded6c8] text-xs font-medium text-[#0f3d3e]"><Eye className="h-3.5 w-3.5" />View project</button><button onClick={() => onFeedback(item)} className="h-10 rounded-lg border border-[#ded6c8] text-xs font-medium text-[#0f3d3e]">Feedback</button>{canPropose && <button disabled={!canEdit} onClick={() => onEdit(item)} className="col-span-2 h-10 rounded-lg border border-[#ded6c8] text-xs font-medium text-[#0f3d3e] disabled:cursor-not-allowed disabled:opacity-40">Propose edit</button>}</div>{canPropose && !canEdit && <p className="mt-2 text-[11px] text-[#8c8272]">Management locked outside your assigned jurisdiction.</p>}</div>;
}

function ProjectDetailsModal({ item, onClose, onFeedback }) {
  const flow = flowFor(item);
  return <div className="fixed inset-0 z-50 flex items-end bg-black/35 sm:items-center sm:justify-center sm:p-4" onClick={onClose}><div role="dialog" aria-modal="true" aria-label="Project details" onClick={e => e.stopPropagation()} className="max-h-[92vh] w-full overflow-y-auto rounded-t-xl bg-white shadow-xl sm:max-w-2xl sm:rounded-xl"><div className="sticky top-0 flex items-start justify-between gap-3 border-b border-[#eee6d8] bg-white px-4 py-4 sm:px-6"><div className="min-w-0"><p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#dc143c]">Public project details</p><h2 className="mt-1 text-lg font-medium text-[#102a2b]">{item.title}</h2><p className="mt-1 text-xs text-[#65706c]">{[item.province, item.district, item.municipality, item.ward && `Ward ${item.ward}`].filter(Boolean).join(' → ')}</p></div><button type="button" onClick={onClose} className="shrink-0 rounded-lg p-2 text-[#8c8272] hover:bg-[#fffaf2]" aria-label="Close project details"><X className="h-4 w-4" /></button></div><div className="space-y-5 p-4 sm:p-6"><div className="flex flex-wrap items-center gap-2"><StageBadge stage={item.status || 'planned'} /><span className="rounded-md bg-[#eef6f4] px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-[#0f3d3e]">{item.programType || item.sector || 'Public program'}</span><span className="text-xs text-[#65706c]">{item.department || 'Department not specified'} · {item.fiscalYear || 'Current fiscal year'}</span></div><div className="rounded-lg border border-[#eee6d8] bg-[#f8fbfd] p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs text-[#65706c]">Delivery progress</p><p className="mt-1 text-xl font-medium tabular-nums text-[#102a2b]">{flow.paidPercent}% spent</p></div><p className="text-right text-xs text-[#65706c]">{formatNPR(flow.paidAmount)} paid<br />of {formatNPR(flow.revisedBudget)}</p></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e7edf3]"><div className="h-full rounded-full bg-[#0f3d3e]" style={{ width: `${flow.paidPercent}%` }} /></div></div><div><h3 className="text-sm font-medium text-[#102a2b]">Financial record</h3><p className="mt-1 text-xs text-[#65706c]">Detailed amounts are shown here to keep the public register easy to scan.</p><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3"><FlowCell label="Original approval" value={flow.originalApprovedBudget} /><FlowCell label="Revised budget" value={flow.revisedBudget} /><FlowCell label="Released" value={flow.releasedAmount} /><FlowCell label="Contracted" value={flow.contractedAmount} /><FlowCell label="Paid" value={flow.paidAmount} accent /><FlowCell label="Remaining" value={flow.remainingAmount} /></div></div><div className="flex flex-col-reverse gap-2 border-t border-[#eee6d8] pt-4 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} className="h-10 rounded-lg border border-[#ded6c8] px-4 text-sm font-medium text-[#65706c]">Close</button><button type="button" onClick={onFeedback} className="h-10 rounded-lg bg-[#0f3d3e] px-4 text-sm font-medium text-white hover:bg-[#102a2b]">Give community feedback</button></div></div></div></div>;
}

const VERDICTS = [
  { value: 'yes', label: 'Yes', helper: 'Work looks useful', icon: ThumbsUp, active: 'border-emerald-300 bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  { value: 'partially', label: 'Partly', helper: 'Some concerns', icon: MessageSquare, active: 'border-amber-300 bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  { value: 'no', label: 'No', helper: 'Concern remains', icon: ThumbsDown, active: 'border-red-300 bg-red-50 text-red-700', dot: 'bg-red-500' },
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
  if (!total) return <p className="mb-4 rounded-lg bg-[#f8fbfd] p-3 text-xs text-[#65706c]">No community feedback yet - be the first to respond.</p>;
  return (
    <div className="mb-4 rounded-lg border border-[#eee6d8] bg-[#fffaf2] p-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-black uppercase tracking-wide text-[#8c8272]">Community verdict</p>
        <p className="text-[11px] font-black text-[#102a2b]">{total} response{total === 1 ? '' : 's'}</p>
      </div>
      <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-[#eee6d8]">
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
              <p className="font-black text-[#102a2b]">{pct}%</p>
              <p className="text-[#8c8272]">{v.label} ({count})</p>
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
    <div className="rounded-lg border border-[#eee6d8] bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#eef6f4] text-[10px] font-black text-[#0f3d3e]">{initials(displayName) || <User className="h-3.5 w-3.5" />}</span>
          <div>
            <p className="text-xs font-black text-[#102a2b]">{displayName}{row.isDemo ? <span className="ml-1 font-normal text-[#8c8272]">· Demo feedback</span> : null}</p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#8c8272]">
              {row.user?.ward && <span className="flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" />Ward {row.user.ward}</span>}
              <span>{relativeTime(row.createdAt)}</span>
            </div>
          </div>
        </div>
        <span className={cn('flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide', meta.active)}>
          <Icon className="h-3 w-3" />{meta.label}
        </span>
      </div>
      {row.comment && <p className="mt-2 text-xs leading-relaxed text-[#65706c]">{row.comment}</p>}
      {row.photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={row.photo} alt="Citizen submitted evidence" className="mt-2 h-28 w-full rounded-lg border border-[#eee6d8] object-cover" />
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

  // Below the xl breakpoint this panel opens as a bottom sheet anchored to
  // whichever row's "Feedback" button was tapped, instead of appending
  // itself as a disconnected block under the (often long) records table -
  // at xl+ it stays inline in the existing sidebar, unchanged.
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 xl:static xl:z-auto xl:block xl:bg-transparent" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="max-h-[88vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl xl:max-h-none xl:overflow-visible xl:rounded-lg xl:border xl:border-[#ded6c8] xl:shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#dc143c]">Community feedback</p>
          <h2 className="mt-0.5 text-sm font-black text-[#102a2b]">{item.title}</h2>
        </div>
        <button onClick={onClose} className="rounded-md p-1.5 text-[#8c8272] hover:bg-[#f7f2ea]"><X className="h-4 w-4" /></button>
      </div>

      <FeedbackSummary stats={stats} />

      <form onSubmit={submit} className="space-y-2.5">
        <div className="grid grid-cols-3 gap-2">
          {VERDICTS.map(v => {
            const Icon = v.icon;
            const active = verdict === v.value;
            return (
              <button key={v.value} type="button" onClick={() => setVerdict(v.value)} className={cn('flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-[11px] font-black transition-colors', active ? v.active : 'border-[#ded6c8] text-[#65706c] hover:bg-[#fffaf2]')}>
                <Icon className="h-4 w-4" />{v.label}
              </button>
            );
          })}
        </div>

        <p className="flex items-center gap-1 text-[11px] text-[#8c8272]"><MapPin className="h-3 w-3" />Posting as your registered ward{ward ? ` - Ward ${ward}` : ' (not set on your profile)'}</p>

        <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Optional public comment" maxLength={1000} className="min-h-20 w-full rounded-lg border border-[#ded6c8] px-3 py-2 text-sm outline-none focus:border-[#0f3d3e]" />

        <div className="flex items-center gap-2">
          <label className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[#ded6c8] px-3 text-xs font-black text-[#0f3d3e] hover:bg-[#eef6f4]">
            Attach photo (optional)
            <input type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
          </label>
          {photo && <span className="flex items-center gap-1 text-[11px] text-[#65706c]">{photo.name}<button type="button" onClick={() => setPhoto(null)} className="text-[#8c8272] hover:text-[#dc143c]"><X className="h-3 w-3" /></button></span>}
        </div>
        {photoError && <p className="text-[11px] text-[#dc143c]">{photoError}</p>}

        <button disabled={saving} className="h-10 w-full rounded-lg bg-[#0f3d3e] text-sm font-black text-white hover:bg-[#102a2b] disabled:opacity-50">
          {saving ? 'Submitting...' : 'Submit feedback'}
        </button>
      </form>

      {(data?.feedback || []).length > 0 && (
        <div className="mt-4 border-t border-[#eee6d8] pt-3">
          <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-[#8c8272]">Recent feedback</p>
          <div className="space-y-2">{(data?.feedback || []).map(row => <FeedbackEntry key={row._id} row={row} />)}</div>
        </div>
      )}

      {stats.total > 0 && (
        <button onClick={() => setShowAll(true)} className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg border border-[#ded6c8] py-2.5 text-xs font-black text-[#0f3d3e] hover:bg-[#eef6f4]">
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
      <div onClick={e => e.stopPropagation()} className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#eee6d8] px-5 py-4">
          <div>
            <h3 className="text-sm font-black text-[#102a2b]">All community feedback</h3>
            <p className="mt-0.5 text-xs text-[#65706c]">{item.title}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-[#8c8272] hover:bg-[#fffaf2]"><X className="h-4 w-4" /></button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          <FeedbackSummary stats={stats} />
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="shimmer h-20 rounded-lg" />)}</div>
          ) : rows.length === 0 ? (
            <p className="rounded-lg bg-[#f8fbfd] p-4 text-center text-xs text-[#65706c]">No feedback yet.</p>
          ) : (
            <div className="space-y-2">{rows.map(row => <FeedbackEntry key={row._id} row={row} />)}</div>
          )}
        </div>

        <div className="border-t border-[#eee6d8] p-3">
          <Pagination page={page} limit={limit} total={total} onPageChange={setPage} onLimitChange={setLimit} pageSizeOptions={[10, 20, 50]} label="feedback entries" />
        </div>
      </div>
    </div>
  );
}

function FlowCell({ label, value, accent }) {
  return <div className="rounded-md border border-[#e2e8ee] bg-[#fbfcfd] px-2 py-1.5"><p className="text-[10px] uppercase tracking-wide text-[#8c8272]">{label}</p><p className={cn('mt-0.5 font-medium tabular-nums', accent ? 'text-[#dc143c]' : 'text-[#102a2b]')}>{formatNPR(value)}</p></div>;
}
function ProposalForm({ creating, selected, proposal, setProposal, submitProposal, saving, cancel }) {
  const enabled = creating || selected;
  const update = (key, value) => setProposal(p => ({ ...p, [key]: value }));
  return <form onSubmit={submitProposal} className="rounded-lg border border-[#ded6c8] bg-white p-5 shadow-sm"><div className="mb-3 flex items-center justify-between"><div><h2 className="text-sm font-medium text-[#102a2b]">{creating ? 'Add budget record' : selected ? 'Propose budget edit' : 'Official workspace'}</h2><p className="text-xs text-[#65706c]">Financial updates go to admin approval.</p></div>{enabled && <button type="button" onClick={cancel} className="rounded-md p-1 text-[#8c8272] hover:bg-[#f7f2ea]"><X className="h-4 w-4" /></button>}</div><div className="grid gap-2 sm:grid-cols-2">{['title','department','sector','fiscalYear','district','municipality','ward'].map(f => <input key={f} disabled={!enabled} value={proposal[f]} onChange={e => update(f, e.target.value)} placeholder={f} className="h-10 rounded-lg border border-[#ded6c8] px-3 text-sm outline-none focus:border-[#0f3d3e] disabled:bg-[#f7f2ea]" />)}<select disabled={!enabled} value={proposal.expenditureType} onChange={e => update('expenditureType', e.target.value)} className="h-10 rounded-lg border border-[#ded6c8] px-3 text-sm outline-none focus:border-[#0f3d3e] disabled:bg-[#f7f2ea]">{EXPENDITURE_TYPES.map(v => <option key={v}>{v}</option>)}</select><select disabled={!enabled} value={proposal.programType} onChange={e => update('programType', e.target.value)} className="h-10 rounded-lg border border-[#ded6c8] px-3 text-sm outline-none focus:border-[#0f3d3e] disabled:bg-[#f7f2ea]">{PROGRAM_TYPES.map(v => <option key={v}>{v}</option>)}</select>{[['amount','allocated amount'],['originalApprovedBudget','original approved'],['revisedBudget','revised budget'],['releasedAmount','released amount'],['contractedAmount','contracted amount'],['paidAmount','paid amount']].map(([key, label]) => <input key={key} disabled={!enabled} type="number" value={proposal[key]} onChange={e => update(key, e.target.value)} placeholder={label} className="h-10 rounded-lg border border-[#ded6c8] px-3 text-sm outline-none focus:border-[#0f3d3e] disabled:bg-[#f7f2ea]" />)}</div><textarea disabled={!enabled} value={proposal.reason} onChange={e => update('reason', e.target.value)} placeholder="Reason for this budget change" className="mt-2 min-h-20 w-full rounded-lg border border-[#ded6c8] px-3 py-2 text-sm outline-none focus:border-[#0f3d3e] disabled:bg-[#f7f2ea]" /><button disabled={!enabled || saving} className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#0f3d3e] text-sm font-medium text-white disabled:opacity-50"><Send className="h-4 w-4" />Submit for approval</button></form>;
}
function Approvals({ changes, canApprove, reviewChange }) {
  const pending = changes.filter(change => change.status === 'pending');
  const visible = canApprove ? pending : changes.slice(0, 5);
  return <div className="rounded-lg border border-[#ded6c8] bg-white shadow-sm"><div className="flex items-center justify-between border-b border-[#eee6d8] px-4 py-3"><div><h2 className="text-sm font-medium text-[#102a2b]">{canApprove ? 'Admin approvals' : 'Recent proposals'}</h2><p className="mt-0.5 text-xs text-[#65706c]">{canApprove ? `${pending.length} awaiting review` : 'Latest budget workflow updates'}</p></div>{pending.length > 0 && <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-700">{pending.length} pending</span>}</div><div className="divide-y divide-[#f2ede4]">{visible.length === 0 ? <p className="px-4 py-7 text-center text-sm text-[#8c8272]">{canApprove ? 'No approvals are waiting.' : 'No budget change history yet.'}</p> : visible.map(change => <div key={change._id} className="p-4"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-medium text-[#102a2b]">{change.budgetItem?.title || change.proposed?.title || 'New budget record'}</p>{change.requestedBy?.name && <p className="mt-0.5 text-xs text-[#65706c]">Requested by {change.requestedBy.name}</p>}</div><span className={cn('shrink-0 rounded-md px-2 py-1 text-[10px] font-medium uppercase tracking-wide', change.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : change.status === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700')}>{change.status}</span></div>{change.reason && <p className="mt-2 line-clamp-2 text-xs text-[#65706c]">{change.reason}</p>}{canApprove && <div className="mt-3 grid grid-cols-2 gap-2"><button onClick={() => reviewChange(change._id, 'approved')} className="flex h-9 items-center justify-center gap-1 rounded-lg bg-emerald-600 text-xs font-medium text-white"><Check className="h-3.5 w-3.5" />Approve</button><button onClick={() => reviewChange(change._id, 'rejected')} className="h-9 rounded-lg bg-red-600 text-xs font-medium text-white">Reject</button></div>}</div>)}</div>{canApprove && changes.length > visible.length && <p className="border-t border-[#eee6d8] px-4 py-2.5 text-center text-xs text-[#65706c]">Only pending requests are shown here.</p>}</div>;
}
