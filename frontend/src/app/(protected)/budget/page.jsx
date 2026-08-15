'use client';
import { useEffect, useMemo, useState } from 'react';
import { get, patch, post, getToken } from '@/lib/api';
import { formatNPR, cn } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';
import { Check, ChevronRight, Download, ListTree, Map, Search, Send, Table2, X } from 'lucide-react';
import { toast } from 'sonner';
import Pagination from '@/components/Pagination';

const emptyProposal = { title: '', department: '', sector: '', amount: '', fiscalYear: '', district: '', municipality: '', ward: '', reason: '' };
const LEVELS = ['province', 'district', 'municipality', 'ward'];
const LEVEL_LABEL = { province: 'Province', district: 'District', municipality: 'Municipality', ward: 'Ward' };
const STAGE_COLORS = { planned: 'bg-slate-100 text-slate-700', ongoing: 'bg-blue-50 text-blue-700', completed: 'bg-emerald-50 text-emerald-700', delayed: 'bg-red-50 text-red-700' };

export default function BudgetPage() {
  const { user } = useAuth();
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
    setProposal({ title: item.title || '', department: item.department || '', sector: item.sector || '', amount: item.amount || '', fiscalYear: item.fiscalYear || '', district: item.district || '', municipality: item.municipality || '', ward: item.ward || '', reason: '' });
  };

  const startCreate = () => { const a = user?.wardRepresentativeApplication || {}; setSelected(null); setCreating(true); setProposal(isWardRep ? { ...emptyProposal, district: a.district || '', municipality: a.municipality || '', ward: a.ward || '' } : emptyProposal); };

  const downloadCsv = async () => {
    try {
      const res = await fetch('/api/budgets/export.csv', { headers: { Authorization: `Bearer ${getToken() || ''}` } });
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
    if (!parent) return true;
    if (currentLevel === 'district') return (item.province || '') === parent.name || item.district === parent.name;
    if (currentLevel === 'municipality') return item.district === parent.name;
    if (currentLevel === 'ward') return item.municipality === parent.name || item.district === parent.parent;
    return true;
  }), [items, parent, currentLevel]);

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
        <div className="flex flex-wrap gap-2">
          <button onClick={downloadCsv} className="flex h-10 items-center gap-2 rounded-lg border border-[#ded6c8] bg-white px-4 text-sm font-medium text-[#0f3d3e] hover:bg-[#fffaf2]"><Download className="h-4 w-4" />Export CSV</button>
          {canPropose && <button onClick={startCreate} className="h-10 rounded-lg bg-[#dc143c] px-4 text-sm font-medium text-white hover:bg-[#b80f31]">Add budget record</button>}
        </div>
      </div>

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
    </div>
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
  return <form onSubmit={submitProposal} className="rounded-lg border border-[#ded6c8] bg-white p-5 shadow-sm"><div className="mb-3 flex items-center justify-between"><div><h2 className="text-sm font-medium text-[#102a2b]">{creating ? 'Add budget record' : selected ? 'Propose edit' : 'Official workspace'}</h2><p className="text-xs text-[#65706c]">Changes go to admin approval.</p></div>{enabled && <button type="button" onClick={cancel} className="rounded-md p-1 text-[#8c8272] hover:bg-[#f7f2ea]"><X className="h-4 w-4" /></button>}</div>{['title','department','sector','fiscalYear','district','municipality','ward'].map(f => <input key={f} disabled={!enabled} value={proposal[f]} onChange={e => setProposal(p => ({ ...p, [f]: e.target.value }))} placeholder={f} className="mb-2 h-10 w-full rounded-lg border border-[#ded6c8] px-3 text-sm outline-none focus:border-[#0f3d3e] disabled:bg-[#f7f2ea]" />)}<input disabled={!enabled} type="number" value={proposal.amount} onChange={e => setProposal(p => ({ ...p, amount: e.target.value }))} placeholder="allocated amount" className="mb-2 h-10 w-full rounded-lg border border-[#ded6c8] px-3 text-sm outline-none focus:border-[#0f3d3e] disabled:bg-[#f7f2ea]" /><textarea disabled={!enabled} value={proposal.reason} onChange={e => setProposal(p => ({ ...p, reason: e.target.value }))} placeholder="Reason" className="mb-3 min-h-20 w-full rounded-lg border border-[#ded6c8] px-3 py-2 text-sm outline-none focus:border-[#0f3d3e] disabled:bg-[#f7f2ea]" /><button disabled={!enabled || saving} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#0f3d3e] text-sm font-medium text-white disabled:opacity-50"><Send className="h-4 w-4" />Submit for approval</button></form>;
}
function Approvals({ changes, canApprove, reviewChange }) {
  return <div className="rounded-lg border border-[#ded6c8] bg-white shadow-sm"><div className="border-b border-[#eee6d8] px-5 py-3"><h2 className="text-sm font-medium text-[#102a2b]">{canApprove ? 'Admin approvals' : 'Pending proposals'}</h2></div><div className="max-h-[420px] divide-y divide-[#f2ede4] overflow-y-auto">{changes.length === 0 ? <p className="px-5 py-8 text-center text-sm text-[#8c8272]">No budget change history yet.</p> : changes.map(change => <div key={change._id} className="p-5"><p className="text-sm font-medium text-[#102a2b]">{change.budgetItem?.title || change.proposed?.title || 'New budget record'}</p>{change.requestedBy?.name && <p className="text-xs text-[#65706c]">By {change.requestedBy.name}</p>}{change.reason && <p className="mt-2 rounded-lg bg-[#f7f2ea] p-2 text-xs text-[#65706c]">{change.reason}</p>}<div className="mt-2 flex items-center justify-between"><span className={cn('rounded-md px-2 py-1 text-[10px] font-medium uppercase tracking-wide', change.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : change.status === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700')}>{change.status}</span></div>{canApprove && change.status === 'pending' && <div className="mt-3 flex gap-2"><button onClick={() => reviewChange(change._id, 'approved')} className="flex h-9 flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-600 text-xs font-medium text-white"><Check className="h-3.5 w-3.5" />Approve</button><button onClick={() => reviewChange(change._id, 'rejected')} className="h-9 flex-1 rounded-lg bg-red-600 text-xs font-medium text-white">Reject</button></div>}</div>)}</div></div>;
}
