'use client';
import { useState } from 'react';
import { get } from '@/lib/api';
import { formatNPR } from '@/lib/format';
import { Download, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';

const KINDS = [
  { value: 'budget-summary', label: 'Budget Summary' },
  { value: 'department-comparison', label: 'Department Comparison' },
];

export default function ReportsPage() {
  const [kind, setKind] = useState('budget-summary');
  const [preview, setPreview] = useState([]);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const data = kind === 'department-comparison'
        ? await get('/api/departments')
        : await get('/api/budgets?limit=50');
      setPreview(kind === 'department-comparison'
        ? (data.departments || []).map(d => ({ Name: d.name, 'Total (NPR)': Math.round(d.total), 'Line Items': d.count, 'Top Sector': d.topSector }))
        : (data.items || []).map(i => ({ Title: i.title, Department: i.department, Sector: i.sector, 'Amount (NPR)': Math.round(i.amount), FY: i.fiscalYear })));
      toast.success(`Report generated — ${(data.departments || data.items || []).length} rows`);
    } catch { toast.error('Failed to generate'); }
    setLoading(false);
  };

  const download = () => {
    if (!preview.length) return;
    const headers = Object.keys(preview[0]);
    const csv = [headers.join(','), ...preview.map(r => headers.map(h => `"${r[h] ?? ''}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${kind}.csv`; a.click(); URL.revokeObjectURL(url);
    toast.success('CSV downloaded');
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-5">
      <div><h1 className="text-2xl font-bold text-gray-900">Reports</h1><p className="text-sm text-gray-500 mt-1">Generate and export budget datasets</p></div>
      <div className="grid lg:grid-cols-[300px_1fr] gap-5">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4 h-fit">
          <div><label className="block text-sm font-semibold text-gray-800 mb-1.5">Template</label><select value={kind} onChange={e => setKind(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm focus:border-brand-500 outline-none">{KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}</select></div>
          <button onClick={generate} disabled={loading} className="w-full h-10 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 active:translate-y-px transition-all disabled:opacity-60 flex items-center justify-center gap-2">
            <FileSpreadsheet className="w-4 h-4" />{loading ? 'Generating…' : 'Generate Report'}
          </button>
          {preview.length > 0 && <button onClick={download} className="w-full h-10 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all flex items-center justify-center gap-2"><Download className="w-4 h-4" />Download CSV</button>}
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100"><h3 className="text-sm font-semibold text-gray-900">Preview{preview.length > 0 && ` (${preview.length} rows)`}</h3></div>
          {preview.length === 0 ? (
            <div className="px-5 py-16 text-center text-gray-400"><FileSpreadsheet className="w-8 h-8 mx-auto mb-2 text-gray-300" />Generate a report to see preview</div>
          ) : (
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-gray-100 text-[10px] uppercase tracking-wider text-gray-400">{Object.keys(preview[0]).map(h => <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>)}</tr></thead><tbody className="divide-y divide-gray-50">{preview.slice(0, 25).map((r, i) => <tr key={i} className="hover:bg-gray-50/60">{Object.values(r).map((v, j) => <td key={j} className="px-4 py-2.5 text-gray-700 truncate max-w-[240px]">{typeof v === 'number' ? formatNPR(v) : v}</td>)}</tr>)}</tbody></table></div>
          )}
        </div>
      </div>
    </div>
  );
}
