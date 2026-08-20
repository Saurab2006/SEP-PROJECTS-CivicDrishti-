'use client';
import { useEffect, useMemo, useState } from 'react';
import { get } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { ScrollText, ShieldCheck, ShieldX, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import Pagination from '@/components/Pagination';
import { relativeTime, cn } from '@/lib/format';

const ACTIONS = [
  { value: 'all', label: 'All actions' },
  { value: 'APPROVE_OFFICIAL', label: 'Approved ward representative' },
  { value: 'REJECT_VERIFICATION', label: 'Rejected verification' },
  { value: 'APPROVE_VERIFICATION', label: 'Approved verification' },
  { value: 'CHANGE_ROLE', label: 'Changed role' },
  { value: 'SUSPEND_USER', label: 'Suspended user' },
  { value: 'REACTIVATE_USER', label: 'Reactivated user' },
  { value: 'DELETE_USER', label: 'Deleted user' },
  { value: 'EDIT_BUDGET', label: 'Edited budget' },
  { value: 'APPROVE_CHANGE', label: 'Approved budget change' },
  { value: 'REJECT_CHANGE', label: 'Rejected budget change' },
  { value: 'IMPORT_BUDGET', label: 'Imported budget CSV' },
  { value: 'CHANGE_REPORT_STATUS', label: 'Changed report status' },
  { value: 'ASSIGN_AUTHORITY', label: 'Assigned authority' },
  { value: 'MARK_FAKE', label: 'Flagged report fake' },
  { value: 'CREATE_AUTHORITY', label: 'Added authority' },
  { value: 'CREATE_NOTICE', label: 'Published notice' },
  { value: 'UPDATE_WARD', label: 'Updated ward office' },
];

const ROLES = [
  { value: 'all', label: 'All roles' },
  { value: 'admin', label: 'Admin' },
  { value: 'municipality_head', label: 'Municipality head' },
  { value: 'ward_rep', label: 'Ward representative' },
];

const inputClass = 'h-10 rounded-lg border border-[var(--gov-border)] bg-white px-3 text-sm outline-none focus:border-[var(--gov-primary)]';

function ResultBadge({ result }) {
  const ok = String(result).toUpperCase() === 'SUCCESS';
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wide', ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
      {ok ? <ShieldCheck className="h-3 w-3" /> : <ShieldX className="h-3 w-3" />}
      {ok ? 'Success' : 'Failure'}
    </span>
  );
}

function ValueDiff({ log }) {
  const [open, setOpen] = useState(false);
  const hasDetail = log.previousValue || log.newValue;
  if (!hasDetail) return null;
  return (
    <div className="mt-1">
      <button type="button" onClick={() => setOpen(o => !o)} className="inline-flex items-center gap-1 text-xs font-medium text-[var(--gov-primary)]">
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {open ? 'Hide details' : 'View details'}
      </button>
      {open && (
        <div className="mt-2 grid gap-2 rounded-lg bg-[var(--gov-surface-soft)] p-3 text-xs sm:grid-cols-2">
          <div>
            <p className="mb-1 font-semibold uppercase tracking-wide text-[var(--gov-muted)]">Previous</p>
            <pre className="whitespace-pre-wrap break-words text-[var(--gov-text)]">{log.previousValue ? JSON.stringify(log.previousValue, null, 2) : '—'}</pre>
          </div>
          <div>
            <p className="mb-1 font-semibold uppercase tracking-wide text-[var(--gov-muted)]">New</p>
            <pre className="whitespace-pre-wrap break-words text-[var(--gov-text)]">{log.newValue ? JSON.stringify(log.newValue, null, 2) : '—'}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AuditLogsPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ actorRole: 'all', action: 'all', result: 'all', q: '', from: '', to: '' });

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
    return params.toString();
  }, [page, limit, filters]);

  const load = () => {
    setLoading(true);
    Promise.all([get(`/api/audit-logs?${query}`), get('/api/audit-logs/summary')])
      .then(([res, s]) => { setLogs(res.logs || []); setTotal(res.total || 0); setSummary(s); setLoading(false); })
      .catch(e => { toast.error(e.message); setLoading(false); });
  };

  useEffect(() => { if (user?.role === 'admin') load(); }, [user?.role, query]);
  useEffect(() => { setPage(1); }, [filters, limit]);

  if (user?.role !== 'admin') return <div className="text-sm text-[var(--gov-muted)]">Admin only.</div>;

  const setFilter = (k, v) => setFilters(f => ({ ...f, [k]: v }));

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="gov-label uppercase">Accountability</p>
          <h1 className="mt-1 text-2xl font-semibold text-[var(--gov-text)]">Audit logs</h1>
        </div>
        <button type="button" onClick={load} className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--gov-border)] bg-white px-4 text-sm font-medium text-[var(--gov-muted)] hover:bg-[#f6f8fb]">
          <RefreshCw className="h-4 w-4" />Refresh
        </button>
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            ['Total actions', summary.total],
            ['Last 30 days', summary.last30],
            ['Approvals', summary.approvals],
            ['Rejections', summary.rejections],
            ['Budget changes', summary.budgetChanges],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-[var(--gov-border)] bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-[var(--gov-muted)]">{label}</p>
              <p className="mt-1 text-2xl font-semibold text-[var(--gov-text)]">{value ?? 0}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-3 rounded-xl border border-[var(--gov-border)] bg-white p-4 shadow-sm">
        <select value={filters.actorRole} onChange={e => setFilter('actorRole', e.target.value)} className={inputClass}>
          {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <select value={filters.action} onChange={e => setFilter('action', e.target.value)} className={inputClass}>
          {ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
        <select value={filters.result} onChange={e => setFilter('result', e.target.value)} className={inputClass}>
          <option value="all">All results</option>
          <option value="success">Success only</option>
          <option value="failure">Failures only</option>
        </select>
        <input type="date" value={filters.from} onChange={e => setFilter('from', e.target.value)} className={inputClass} title="From date" />
        <input type="date" value={filters.to} onChange={e => setFilter('to', e.target.value)} className={inputClass} title="To date" />
        <input value={filters.q} onChange={e => setFilter('q', e.target.value)} placeholder="Search by admin or record name" className={cn(inputClass, 'min-w-[220px] flex-1')} />
      </div>

      <section className="rounded-xl border border-[var(--gov-border)] bg-white shadow-sm">
        <div className="border-b border-[var(--gov-border)] px-5 py-3">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--gov-text)]"><ScrollText className="h-4 w-4 text-[var(--gov-primary)]" />Activity</h2>
        </div>
        <div className="divide-y divide-[var(--gov-border)]">
          {loading ? (
            <p className="p-5 text-sm text-[var(--gov-muted)]">Loading...</p>
          ) : logs.length === 0 ? (
            <p className="p-5 text-sm text-[var(--gov-muted)]">No matching audit records.</p>
          ) : logs.map(log => (
            <div key={log._id} className="grid gap-2 p-4 lg:grid-cols-[1fr_auto] lg:items-start lg:p-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-[var(--gov-text)]">{log.actionLabel || log.action}</p>
                  <ResultBadge result={log.result} />
                </div>
                <p className="mt-1 text-sm text-[var(--gov-muted)]">
                  <span className="font-medium text-[var(--gov-text)]">{log.actorName || log.actor?.name || 'Unknown'}</span>
                  {' '}({log.actorRole}) on {log.targetType}{log.targetLabel ? ` "${log.targetLabel}"` : ''}
                </p>
                {(log.province || log.municipality || log.ward) && (
                  <p className="mt-1 text-xs text-[var(--gov-muted)]">{[log.province, log.district, log.municipality, log.ward ? `Ward ${log.ward}` : ''].filter(Boolean).join(' / ')}</p>
                )}
                <ValueDiff log={log} />
              </div>
              <div className="text-left text-xs text-[var(--gov-muted)] lg:text-right">
                <p>{relativeTime(log.createdAt)}</p>
                <p className="mt-0.5">{new Date(log.createdAt).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-[var(--gov-border)] p-3">
          <Pagination page={page} limit={limit} total={total} onPageChange={setPage} onLimitChange={setLimit} label="audit records" />
        </div>
      </section>
    </div>
  );
}