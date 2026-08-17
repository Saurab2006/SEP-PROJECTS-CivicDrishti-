'use client';
import { useEffect, useMemo, useState } from 'react';
import { get, patch, post, getToken } from '@/lib/api';
import { formatNPR, cn } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';
import { AlertTriangle, Check, CheckCircle2, ChevronRight, Download, FileText, ListTree, Map, Search, Send, Table2, TrendingDown, TrendingUp, X } from 'lucide-react';
import { toast } from 'sonner';
import Pagination from '@/components/Pagination';

const emptyProposal = { title: '', department: '', sector: '', amount: '', revisedAmount: '', fiscalYear: '', district: '', municipality: '', ward: '', reason: '' };
const LEVELS = ['province', 'district', 'municipality', 'ward'];
const LEVEL_LABEL = { province: 'Province', district: 'District', municipality: 'Municipality', ward: 'Ward' };
const STAGE_COLORS = { planned: 'bg-slate-100 text-slate-700', ongoing: 'bg-blue-50 text-blue-700', completed: 'bg-emerald-50 text-emerald-700', delayed: 'bg-red-50 text-red-700' };

export default function BudgetPage() {
  const { user } = useAuth();
  const [topTab, setTopTab] = useState('explorer'); // 'explorer' | 'variance'
  const [tracking, setTracking] = useState(null);
  const [items, setItems] = useState([]);
  const [changes, setChanges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [view, setView] = useState('map');
  const [path, setPath] = useState([]);
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [proposal, setProposal] = useState(emptyProposal);
  const [budgetPage, setBudgetPage] = useState(1);
  const [budgetLimit, setBudgetLimit] = useState(8);
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [fiscalYearFilter, setFiscalYearFilter] = useState('all');
  const [departments, setDepartments] = useState([]);
  const [fiscalYears, setFiscalYears] = useState([]);

  const canPropose = user?.role === 'municipality_head' || user?.role === 'ward_rep';
  const isWardRep = user?.role === 'ward_rep';
  const canApprove = user?.role === 'admin';
  const currentLevel = LEVELS[Math.min(path.length, LEVELS.length - 1)];
  const parent = path[path.length - 1] || null;

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
  useEffect(() => {
    Promise.all([get('/api/budgets/meta/departments'), get('/api/budgets/meta/fiscal-years')])
      .then(([d, f]) => { setDepartments(d.departments || []); setFiscalYears(f.fiscalYears || []); })
      .catch(() => {});
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
    return provinces.reduce((acc, n) => ({ allocated: acc.allocated + n.allocated, spent: acc.spent + n.spent, completed: acc.completed + n.completed, remaining: acc.remaining + n.remaining, projectCount: acc.projectCount + n.projectCount }), { allocated: 0, spent: 0, completed: 0, remaining: 0, projectCount: 0 });
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
    setCreating(false);
    setSelected(item);
    setProposal({ title: item.title || '', department: item.department || '', sector: item.sector || '', amount: item.amount || '', revisedAmount: item.revisedAmount ?? '', fiscalYear: item.fiscalYear || '', district: item.district || '', municipality: item.municipality || '', ward: item.ward || '', reason: '' });
  };

  const startCreate = () => { const a = user?.wardRepresentativeApplication || {}; setSelected(null); setCreating(true); setProposal(isWardRep ? { ...emptyProposal, district: a.district || '', municipality: a.municipality || '', ward: a.ward || '' } : emptyProposal); };

  const buildExportParams = () => {
    const params = new URLSearchParams();
    if (currentLevel === 'district' && parent) params.set('province', parent.name);
    if (currentLevel === 'municipality' && parent) params.set('district', parent.name);
    if (currentLevel === 'ward' && parent) params.set('municipality', parent.name);
    if (departmentFilter !== 'all') params.set('department', departmentFilter);
    if (fiscalYearFilter !== 'all') params.set('fiscalYear', fiscalYearFilter);
    if (q.trim()) params.set('project', q.trim());
    return params;
  };

  const downloadCsv = async () => {
    try {
      const params = buildExportParams();
      const res = await fetch(`/api/budgets/export.csv?${params.toString()}`, { headers: { Authorization: `Bearer ${getToken() || ''}` } });
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
    } catch (err) {
      toast.error(err.message);
    }
  };

  const downloadPdf = async () => {
    try {
      const params = buildExportParams();
      const res = await fetch(`/api/budgets/export.json?${params.toString()}`, { headers: { Authorization: `Bearer ${getToken() || ''}` } });
      if (!res.ok) throw new Error('Could not fetch export data');
      const { items: rows, totals, generatedAt } = await res.json();

      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF({ orientation: 'landscape' });

      doc.setFontSize(16);
      doc.text('Civicदृष्टि — Public Budget Transparency', 14, 15);
      doc.setFontSize(10);
      const scope = [
        currentLevel === 'district' && parent ? `Province: ${parent.name}` : null,
        currentLevel === 'municipality' && parent ? `District: ${parent.name}` : null,
        currentLevel === 'ward' && parent ? `Municipality: ${parent.name}` : null,
        departmentFilter !== 'all' ? `Department: ${departmentFilter}` : null,
        fiscalYearFilter !== 'all' ? `Fiscal Year: ${fiscalYearFilter}` : null,
      ].filter(Boolean).join('  |  ') || 'All records';
      doc.text(scope, 14, 22);
      doc.text(`Generated: ${new Date(generatedAt).toLocaleString()}`, 14, 27);

      doc.setFontSize(11);
      doc.text(`Total Allocated: ${formatNPR(totals.allocated)}`, 14, 35);
      doc.text(`Total Spent: ${formatNPR(totals.spent)}`, 100, 35);
      doc.text(`Total Remaining: ${formatNPR(totals.remaining)}`, 186, 35);

      autoTable(doc, {
        startY: 40,
        head: [['Project', 'Department', 'District', 'Fiscal Year', 'Allocated', 'Spent', 'Remaining', 'Util %', 'Status']],
        body: rows.map(r => [r.title, r.department, r.district, r.fiscalYear, formatNPR(r.allocated), formatNPR(r.spent), formatNPR(r.remaining), `${r.utilization}%`, r.status]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [15, 61, 62] },
      });

      doc.save('civicdrishti-budget-report.pdf');
      toast.success('Budget PDF downloaded');
    } catch (err) {
      toast.error(err.message || 'Could not generate PDF');
    }
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
    if (departmentFilter !== 'all' && item.department !== departmentFilter) return false;
    if (fiscalYearFilter !== 'all' && item.fiscalYear !== fiscalYearFilter) return false;
    if (!parent) return true;
    if (currentLevel === 'district') return (item.province || '') === parent.name || item.district === parent.name;
    if (currentLevel === 'municipality') return item.district === parent.name;
    if (currentLevel === 'ward') return item.municipality === parent.name || item.district === parent.parent;
    return true;
  }), [items, parent, currentLevel, departmentFilter, fiscalYearFilter]);

  useEffect(() => { setBudgetPage(1); }, [parent?.name, currentLevel, budgetLimit]);

  const budgetPages = Math.max(1, Math.ceil(filteredItems.length / budgetLimit));
  const safeBudgetPage = Math.min(budgetPage, budgetPages);
  const visibleItems = filteredItems.slice((safeBudgetPage - 1) * budgetLimit, safeBudgetPage * budgetLimit);

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#dc143c]">Civicदृष्टि live public money chain</p>
          <h1 className="mt-1 text-2xl font-medium text-[#102a2b]">Province to Ward Budget Tracking</h1>
          <p className="mt-1 text-sm text-[#65706c]">{isWardRep ? `You are managing ${user?.wardRepresentativeApplication?.district || 'your district'}, ${user?.wardRepresentativeApplication?.municipality || 'your municipality'}, Ward ${user?.wardRepresentativeApplication?.ward || ''}.` : `Follow allocation, live spend, and work completion from Nepal's 7 provinces down to districts, municipalities, and wards.`}</p>
        </div>
        {topTab === 'explorer' && (
          <div className="flex flex-wrap items-center gap-2">
            <select value={departmentFilter} onChange={e => setDepartmentFilter(e.target.value)} className="h-10 rounded-lg border border-[#ded6c8] bg-white px-3 text-sm text-[#0f3d3e] outline-none focus:border-[#0f3d3e]">
              <option value="all">All departments</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={fiscalYearFilter} onChange={e => setFiscalYearFilter(e.target.value)} className="h-10 rounded-lg border border-[#ded6c8] bg-white px-3 text-sm text-[#0f3d3e] outline-none focus:border-[#0f3d3e]">
              <option value="all">All fiscal years</option>
              {fiscalYears.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <button onClick={downloadCsv} className="flex h-10 items-center gap-2 rounded-lg border border-[#ded6c8] bg-white px-4 text-sm font-medium text-[#0f3d3e] hover:bg-[#fffaf2]"><Download className="h-4 w-4" />CSV</button>
            <button onClick={downloadPdf} className="flex h-10 items-center gap-2 rounded-lg border border-[#ded6c8] bg-white px-4 text-sm font-medium text-[#0f3d3e] hover:bg-[#fffaf2]"><FileText className="h-4 w-4" />PDF</button>
            {canPropose && <button onClick={startCreate} className="h-10 rounded-lg bg-[#dc143c] px-4 text-sm font-medium text-white hover:bg-[#b80f31]">Add budget record</button>}
          </div>
        )}
      </div>

      <div className="flex w-fit rounded-lg border border-[#ded6c8] bg-white p-1 shadow-sm">
        <button onClick={() => setTopTab('explorer')} className={cn('rounded-md px-4 py-2 text-sm font-medium transition-colors', topTab === 'explorer' ? 'bg-[#0f3d3e] text-white' : 'text-[#65706c] hover:text-[#102a2b]')}>
          Budget Explorer
        </button>
        <button onClick={() => setTopTab('variance')} className={cn('rounded-md px-4 py-2 text-sm font-medium transition-colors', topTab === 'variance' ? 'bg-[#0f3d3e] text-white' : 'text-[#65706c] hover:text-[#102a2b]')}>
          Variance Alerts
        </button>
      </div>

      {topTab === 'variance' ? (
        <VarianceAlerts items={items} departments={departments} loading={loading} />
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <Metric label="Allocated" value={formatNPR(total.allocated)} />
            <Metric label="Spent so far" value={formatNPR(total.spent)} />
            <Metric label="Completed value" value={formatNPR(total.completed)} />
            <Metric label="Yet to complete" value={formatNPR(total.remaining)} />
          </div>

          <div className="rounded-lg border border-[#ded6c8] bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eee6d8] p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-[#65706c]">
                <button onClick={() => jumpTo(-1)} className={cn('rounded-md px-2 py-1', path.length === 0 ? 'bg-[#eef6f4] text-[#0f3d3e]' : 'hover:bg-[#f7f2ea]')}>Provinces</button>
                {path.map((p, i) => <span key={p.id} className="flex items-center gap-2"><ChevronRight className="h-4 w-4 text-[#b8ad9b]" /><button onClick={() => jumpTo(i)} className="rounded-md px-2 py-1 hover:bg-[#f7f2ea]">{p.name}</button></span>)}
              </div>
              <div className="flex items-center gap-2">
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

          <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
            <div className="rounded-lg border border-[#ded6c8] bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-[#eee6d8] px-5 py-3">
                <h2 className="text-sm font-medium text-[#102a2b]">Budget lines behind this view</h2>
                <span className="text-xs text-[#65706c]">{filteredItems.length} records</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b-2 border-[#102a2b] text-left text-[11px] text-[#8c8272]"><th className="px-5 py-3 font-normal">Project</th><th className="px-5 py-3 font-normal">Area</th><th className="px-5 py-3 font-normal">Status</th><th className="px-5 py-3 text-right font-normal">Allocated</th>{canPropose && <th className="px-5 py-3 text-right font-normal">Action</th>}</tr></thead>
                  <tbody className="divide-y divide-[#f2ede4]">
                    {visibleItems.length === 0 ? <tr><td colSpan={canPropose ? 5 : 4} className="px-5 py-12 text-center text-sm text-[#8c8272]"><Table2 className="mx-auto mb-2 h-7 w-7 text-[#cfc4b4]" />No budget lines in this level yet.</td></tr> : visibleItems.map(item => <tr key={item._id} className="hover:bg-[#fffaf2]"><td className="px-5 py-3.5"><p className="font-medium text-[#102a2b]">{item.title}</p><p className="text-xs text-[#8c8272]">{item.department}</p></td><td className="px-5 py-3.5 text-xs text-[#8c8272]">{item.district}{item.municipality ? `, ${item.municipality}` : ''}{item.ward ? `, Ward ${item.ward}` : ''}</td><td className="px-5 py-3.5"><StageBadge stage={item.status || 'planned'} /></td><td className="px-5 py-3.5 text-right text-[16px] font-medium text-[#0f6e56]">{formatNPR(item.amount)}</td>{canPropose && <td className="px-5 py-3.5 text-right"><button onClick={() => selectItem(item)} className="rounded-lg border border-[#ded6c8] px-3 py-1.5 text-xs font-medium text-[#0f3d3e] hover:bg-[#eef6f4]">Edit</button></td>}</tr>)}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-[#eee6d8] p-4">
                <Pagination page={safeBudgetPage} limit={budgetLimit} total={filteredItems.length} onPageChange={setBudgetPage} onLimitChange={setBudgetLimit} pageSizeOptions={[8, 16, 32, 64]} label="budget lines" />
              </div>
            </div>

            <aside className="space-y-5">
              {canPropose && <ProposalForm creating={creating} selected={selected} proposal={proposal} setProposal={setProposal} submitProposal={submitProposal} saving={saving} cancel={() => { setCreating(false); setSelected(null); }} />}
              {(canApprove || canPropose) && <Approvals changes={changes} canApprove={canApprove} reviewChange={reviewChange} />}
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

// --- Variance Alerts tab -----------------------------------------------
const ALERT_META = {
  overspending: { label: 'Overspending', color: 'bg-red-50 text-red-700 border-red-200', icon: TrendingUp },
  underutilized: { label: 'Underutilized', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: TrendingDown },
  needsAttention: { label: 'Needs Attention', color: 'bg-orange-50 text-orange-700 border-orange-200', icon: AlertTriangle },
  onTrack: { label: 'On Track', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
};

function computeAlert(item, thresholds) {
  const effectiveBudget = item.revisedAmount ?? item.amount ?? 0;
  const spent = item.spent || 0;
  const variance = spent - effectiveBudget;
  const variancePercent = effectiveBudget ? Math.round((variance / effectiveBudget) * 1000) / 10 : 0;
  const financialProgress = item.financialProgress ?? (effectiveBudget ? Math.round((spent / effectiveBudget) * 1000) / 10 : 0);
  const physicalProgress = item.physicalProgress ?? 0;
  const progressGap = Math.round((financialProgress - physicalProgress) * 10) / 10;

  let alert = 'onTrack';
  if (variancePercent > thresholds.overspend) alert = 'overspending';
  else if (variancePercent < -thresholds.underutilize) alert = 'underutilized';
  else if (Math.abs(progressGap) > thresholds.mismatch) alert = 'needsAttention';

  return { effectiveBudget, spent, remaining: Math.max(0, effectiveBudget - spent), variance, variancePercent, financialProgress, physicalProgress, progressGap, alert };
}

function VarianceAlerts({ items, loading }) {
  const [provinceFilter, setProvinceFilter] = useState('all');
  const [municipalityFilter, setMunicipalityFilter] = useState('all');
  const [wardFilter, setWardFilter] = useState('all');
  const [projectQuery, setProjectQuery] = useState('');
  const [thresholds, setThresholds] = useState({ overspend: 10, underutilize: 20, mismatch: 20 });

  const provinces = useMemo(() => [...new Set(items.map(i => i.province).filter(Boolean))].sort(), [items]);
  const municipalities = useMemo(() => [...new Set(items.filter(i => provinceFilter === 'all' || i.province === provinceFilter).map(i => i.municipality).filter(Boolean))].sort(), [items, provinceFilter]);
  const wards = useMemo(() => [...new Set(items.filter(i => municipalityFilter === 'all' || i.municipality === municipalityFilter).map(i => i.ward).filter(Boolean))].sort(), [items, municipalityFilter]);

  const rows = useMemo(() => items
    .filter(i => provinceFilter === 'all' || i.province === provinceFilter)
    .filter(i => municipalityFilter === 'all' || i.municipality === municipalityFilter)
    .filter(i => wardFilter === 'all' || i.ward === wardFilter)
    .filter(i => !projectQuery.trim() || new RegExp(projectQuery.trim(), 'i').test(i.title))
    .map(i => ({ ...i, ...computeAlert(i, thresholds) })), [items, provinceFilter, municipalityFilter, wardFilter, projectQuery, thresholds]);

  const counts = useMemo(() => rows.reduce((acc, r) => { acc[r.alert] = (acc[r.alert] || 0) + 1; return acc; }, {}), [rows]);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-4">
        {Object.entries(ALERT_META).map(([key, meta]) => (
          <div key={key} className={cn('rounded-lg border p-4', meta.color)}>
            <p className="flex items-center gap-1.5 text-xs font-medium"><meta.icon className="h-3.5 w-3.5" />{meta.label}</p>
            <p className="mt-1 text-2xl font-medium">{counts[key] || 0}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-[#ded6c8] bg-white p-4 shadow-sm">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[#8c8272]">Filter by location & project</p>
        <div className="grid gap-2 sm:grid-cols-4">
          <select value={provinceFilter} onChange={e => { setProvinceFilter(e.target.value); setMunicipalityFilter('all'); setWardFilter('all'); }} className="h-10 rounded-lg border border-[#ded6c8] bg-[#fffcf7] px-3 text-sm outline-none focus:border-[#0f3d3e]">
            <option value="all">All provinces</option>
            {provinces.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={municipalityFilter} onChange={e => { setMunicipalityFilter(e.target.value); setWardFilter('all'); }} className="h-10 rounded-lg border border-[#ded6c8] bg-[#fffcf7] px-3 text-sm outline-none focus:border-[#0f3d3e]">
            <option value="all">All municipalities</option>
            {municipalities.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={wardFilter} onChange={e => setWardFilter(e.target.value)} className="h-10 rounded-lg border border-[#ded6c8] bg-[#fffcf7] px-3 text-sm outline-none focus:border-[#0f3d3e]">
            <option value="all">All wards</option>
            {wards.map(w => <option key={w} value={w}>Ward {w}</option>)}
          </select>
          <input value={projectQuery} onChange={e => setProjectQuery(e.target.value)} placeholder="Search project..." className="h-10 rounded-lg border border-[#ded6c8] bg-[#fffcf7] px-3 text-sm outline-none focus:border-[#0f3d3e]" />
        </div>

        <p className="mb-2 mt-4 text-xs font-medium uppercase tracking-wide text-[#8c8272]">Alert thresholds (adjust to your comfort level)</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <ThresholdInput label="Overspend alert above" value={thresholds.overspend} onChange={v => setThresholds(t => ({ ...t, overspend: v }))} />
          <ThresholdInput label="Underutilized alert below" value={thresholds.underutilize} onChange={v => setThresholds(t => ({ ...t, underutilize: v }))} />
          <ThresholdInput label="Progress mismatch alert above" value={thresholds.mismatch} onChange={v => setThresholds(t => ({ ...t, mismatch: v }))} />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-[#ded6c8] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-[#102a2b] text-left text-[11px] text-[#8c8272]">
                <th className="px-4 py-3 font-normal">Project</th>
                <th className="px-4 py-3 font-normal">Area</th>
                <th className="px-4 py-3 text-right font-normal">Allocated</th>
                <th className="px-4 py-3 text-right font-normal">Revised</th>
                <th className="px-4 py-3 text-right font-normal">Spent</th>
                <th className="px-4 py-3 text-right font-normal">Remaining</th>
                <th className="px-4 py-3 text-right font-normal">Variance</th>
                <th className="px-4 py-3 font-normal">Financial vs Physical</th>
                <th className="px-4 py-3 font-normal">Alert</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f2ede4]">
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center"><div className="shimmer mx-auto h-6 w-40 rounded" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-sm text-[#8c8272]"><AlertTriangle className="mx-auto mb-2 h-7 w-7 text-[#cfc4b4]" />No budget lines match this filter.</td></tr>
              ) : rows.map(r => {
                const meta = ALERT_META[r.alert];
                return (
                  <tr key={r._id} className="hover:bg-[#fffaf2]">
                    <td className="px-4 py-3"><p className="font-medium text-[#102a2b]">{r.title}</p><p className="text-xs text-[#8c8272]">{r.department}</p></td>
                    <td className="px-4 py-3 text-xs text-[#8c8272]">{r.district}{r.municipality ? `, ${r.municipality}` : ''}{r.ward ? `, Ward ${r.ward}` : ''}</td>
                    <td className="px-4 py-3 text-right text-[#102a2b]">{formatNPR(r.amount)}</td>
                    <td className="px-4 py-3 text-right text-[#102a2b]">{r.revisedAmount != null ? formatNPR(r.revisedAmount) : <span className="text-[#b8ad9b]">—</span>}</td>
                    <td className="px-4 py-3 text-right text-[#102a2b]">{formatNPR(r.spent)}</td>
                    <td className="px-4 py-3 text-right text-[#102a2b]">{formatNPR(r.remaining)}</td>
                    <td className={cn('px-4 py-3 text-right font-medium', r.variance > 0 ? 'text-red-600' : 'text-emerald-600')}>{r.variance > 0 ? '+' : ''}{formatNPR(r.variance)} ({r.variancePercent > 0 ? '+' : ''}{r.variancePercent}%)</td>
                    <td className="px-4 py-3 text-xs text-[#65706c]">Spent {r.financialProgress}% · Built {r.physicalProgress}%</td>
                    <td className="px-4 py-3"><span className={cn('flex w-fit items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium uppercase tracking-wide', meta.color)}><meta.icon className="h-3 w-3" />{meta.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ThresholdInput({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-[#65706c]">{label}</span>
      <div className="flex items-center gap-2">
        <input type="number" min="0" value={value} onChange={e => onChange(Number(e.target.value) || 0)} className="h-10 w-full rounded-lg border border-[#ded6c8] bg-[#fffcf7] px-3 text-sm outline-none focus:border-[#0f3d3e]" />
        <span className="text-sm text-[#8c8272]">%</span>
      </div>
    </label>
  );
}

function Metric({ label, value }) {
  return <div className="rounded-lg border border-[#ded6c8] bg-white p-4 shadow-sm"><p className="text-[11px] text-[#8c8272]">{label}</p><p className="mt-1 text-[26px] font-medium tracking-tight tabular-nums text-[#0f6e56]">{value}</p></div>;
}
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
  return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{nodes.map((n, i) => <button key={n.id} onClick={() => onDrill(n)} className="min-h-40 rounded-lg border border-[#ded6c8] bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-[#0f3d3e] hover:shadow-md"><div className="flex items-start justify-between"><div><p className="text-[11px] text-[#8c8272]">{LEVEL_LABEL[level]}</p><h3 className="mt-1 text-[17px] font-medium text-[#102a2b]">{n.name}</h3></div><span className="grid h-7 w-7 place-items-center rounded-md bg-[#f7f2ea] text-[11px] text-[#8c8272]">{i + 1}</span></div><p className="mt-5 text-[11px] text-[#8c8272]">Allocated</p><p className="mt-0.5 text-[26px] font-medium tracking-tight text-[#0f6e56]">{formatNPR(n.allocated)}</p><div className="mt-4"><Progress node={n} /></div><div className="mt-3 flex flex-wrap items-center gap-2"><StageBadge stage="planned" /><span className="text-[11px] text-[#8c8272]">{n.projectCount} records</span></div></button>)}</div>;
}
function ListView({ nodes, level, onDrill }) {
  return <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b-2 border-[#102a2b] text-left text-[11px] text-[#8c8272]"><th className="px-3 py-3">{LEVEL_LABEL[level]}</th><th className="px-3 py-3 text-right">Allocated</th><th className="px-3 py-3 text-right">Spent</th><th className="px-3 py-3">Completion</th><th className="px-3 py-3">Stages</th></tr></thead><tbody className="divide-y divide-[#f2ede4]">{nodes.map(n => <tr key={n.id} onClick={() => onDrill(n)} className="cursor-pointer hover:bg-[#fffaf2]"><td className="px-3 py-3.5 font-medium text-[#102a2b]">{n.name}</td><td className="px-3 py-3.5 text-right text-[15px] font-medium text-[#0f6e56]">{formatNPR(n.allocated)}</td><td className="px-3 py-3.5 text-right text-[15px] font-medium text-[#0f6e56]">{formatNPR(n.spent)}</td><td className="min-w-56 px-3 py-3.5"><Progress node={n} /></td><td className="px-3 py-3.5 text-xs text-[#8c8272]">{n.planned} planned / {n.ongoing} ongoing / {n.completedStage} done / {n.delayed} delayed</td></tr>)}</tbody></table></div>;
}
function ProposalForm({ creating, selected, proposal, setProposal, submitProposal, saving, cancel }) {
  const enabled = creating || selected;
  return <form onSubmit={submitProposal} className="rounded-lg border border-[#ded6c8] bg-white p-5 shadow-sm"><div className="mb-3 flex items-center justify-between"><div><h2 className="text-sm font-medium text-[#102a2b]">{creating ? 'Add budget record' : selected ? 'Propose edit' : 'Official workspace'}</h2><p className="text-xs text-[#65706c]">Changes go to admin approval.</p></div>{enabled && <button type="button" onClick={cancel} className="rounded-md p-1 text-[#8c8272] hover:bg-[#f7f2ea]"><X className="h-4 w-4" /></button>}</div>{['title','department','sector','fiscalYear','district','municipality','ward'].map(f => <input key={f} disabled={!enabled} value={proposal[f]} onChange={e => setProposal(p => ({ ...p, [f]: e.target.value }))} placeholder={f} className="mb-2 h-10 w-full rounded-lg border border-[#ded6c8] px-3 text-sm outline-none focus:border-[#0f3d3e] disabled:bg-[#f7f2ea]" />)}<input disabled={!enabled} type="number" value={proposal.amount} onChange={e => setProposal(p => ({ ...p, amount: e.target.value }))} placeholder="allocated amount" className="mb-2 h-10 w-full rounded-lg border border-[#ded6c8] px-3 text-sm outline-none focus:border-[#0f3d3e] disabled:bg-[#f7f2ea]" /><input disabled={!enabled} type="number" value={proposal.revisedAmount} onChange={e => setProposal(p => ({ ...p, revisedAmount: e.target.value }))} placeholder="revised amount (optional)" className="mb-2 h-10 w-full rounded-lg border border-[#ded6c8] px-3 text-sm outline-none focus:border-[#0f3d3e] disabled:bg-[#f7f2ea]" /><textarea disabled={!enabled} value={proposal.reason} onChange={e => setProposal(p => ({ ...p, reason: e.target.value }))} placeholder="Reason" className="mb-3 min-h-20 w-full rounded-lg border border-[#ded6c8] px-3 py-2 text-sm outline-none focus:border-[#0f3d3e] disabled:bg-[#f7f2ea]" /><button disabled={!enabled || saving} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#0f3d3e] text-sm font-medium text-white disabled:opacity-50"><Send className="h-4 w-4" />Submit for approval</button></form>;
}
function Approvals({ changes, canApprove, reviewChange }) {
  return <div className="rounded-lg border border-[#ded6c8] bg-white shadow-sm"><div className="border-b border-[#eee6d8] px-5 py-3"><h2 className="text-sm font-medium text-[#102a2b]">{canApprove ? 'Admin approvals' : 'Pending proposals'}</h2></div><div className="max-h-[420px] divide-y divide-[#f2ede4] overflow-y-auto">{changes.length === 0 ? <p className="px-5 py-8 text-center text-sm text-[#8c8272]">No budget change history yet.</p> : changes.map(change => <div key={change._id} className="p-5"><p className="text-sm font-medium text-[#102a2b]">{change.budgetItem?.title || change.proposed?.title || 'New budget record'}</p>{change.requestedBy?.name && <p className="text-xs text-[#65706c]">By {change.requestedBy.name}</p>}{change.reason && <p className="mt-2 rounded-lg bg-[#f7f2ea] p-2 text-xs text-[#65706c]">{change.reason}</p>}<div className="mt-2 flex items-center justify-between"><span className={cn('rounded-md px-2 py-1 text-[10px] font-medium uppercase tracking-wide', change.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : change.status === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700')}>{change.status}</span></div>{canApprove && change.status === 'pending' && <div className="mt-3 flex gap-2"><button onClick={() => reviewChange(change._id, 'approved')} className="flex h-9 flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-600 text-xs font-medium text-white"><Check className="h-3.5 w-3.5" />Approve</button><button onClick={() => reviewChange(change._id, 'rejected')} className="h-9 flex-1 rounded-lg bg-red-600 text-xs font-medium text-white">Reject</button></div>}</div>)}</div></div>;
}