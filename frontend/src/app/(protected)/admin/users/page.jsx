'use client';
import { useEffect, useState } from 'react';
import { del, get, patch } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { formatNumber, relativeTime, initials, cn } from '@/lib/format';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { ShieldCheck, ShieldAlert, ShieldQuestion, X, Loader2, Trash2 } from 'lucide-react';

const VERIFICATION_STYLE = {
  verified: { label: 'Verified', icon: ShieldCheck, cls: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  pending: { label: 'Pending review', icon: ShieldQuestion, cls: 'bg-amber-50 text-amber-700 border-amber-100' },
  rejected: { label: 'Rejected', icon: ShieldAlert, cls: 'bg-red-50 text-red-700 border-red-100' },
  'n/a': { label: '-', icon: null, cls: 'bg-gray-50 text-gray-400 border-gray-100' },
};

export default function UsersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState(null);

  const mergeUser = (updated) => {
    setUsers(prev => prev.map(u => u._id === updated._id ? { ...u, ...updated, documentCount: u.documentCount } : u));
    setViewing(v => v && v._id === updated._id ? { ...v, ...updated } : v);
  };

  useEffect(() => {
    if (user?.role !== 'admin') { router.push('/dashboard'); return; }
    get('/api/users').then(d => { setUsers(d.users || []); setLoading(false); }).catch(() => setLoading(false));
  }, [user, router]);

  const changeRole = async (id, role) => {
    try {
      const { user: updated } = await patch(`/api/users/${id}`, { role });
      mergeUser(updated);
      toast.success('Role updated');
    } catch (e) { toast.error(e.message); }
  };

  const changeStatus = async (id, status) => {
    try {
      const { user: updated } = await patch(`/api/users/${id}`, { status });
      mergeUser(updated);
      toast.success(status === 'suspended' ? 'User banned' : 'User restored');
    } catch (e) { toast.error(e.message); }
  };

  const removeUser = async (id, name) => {
    if (!window.confirm(`Remove ${name}? This cannot be undone.`)) return;
    try {
      await del(`/api/users/${id}`);
      setUsers(prev => prev.filter(u => u._id !== id));
      toast.success('User removed');
    } catch (e) { toast.error(e.message); }
  };

  const setVerification = async (id, verificationStatus) => {
    try {
      const { user: updated } = await patch(`/api/users/${id}`, { verificationStatus });
      mergeUser(updated);
      toast.success(verificationStatus === 'verified' ? 'Identity verified' : 'Rejected and banned');
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-5">
      <div><h1 className="text-2xl font-bold text-gray-900">User Management</h1><p className="text-sm text-gray-500 mt-1">Manage team roles, access, and citizen identity verification</p></div>
      <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
        <table className="w-full min-w-[980px] text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-[10px] uppercase tracking-wider text-gray-400">
              <th className="px-5 py-3 text-left font-semibold">User</th>
              <th className="px-5 py-3 text-left font-semibold">Docs</th>
              <th className="px-5 py-3 text-left font-semibold">Role</th>
              <th className="px-5 py-3 text-left font-semibold">Identity</th>
              <th className="px-5 py-3 text-left font-semibold">Status</th>
              <th className="px-5 py-3 text-left font-semibold">Joined</th>
              <th className="px-5 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? Array.from({ length: 4 }).map((_, i) => <tr key={i}><td colSpan={7} className="px-5 py-4"><div className="shimmer h-4 rounded w-full" /></td></tr>) : users.map(u => {
              const v = VERIFICATION_STYLE[u.verificationStatus] || VERIFICATION_STYLE['n/a'];
              const self = u._id === user._id;
              return (
                <tr key={u._id} className="hover:bg-gray-50/60">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: `linear-gradient(135deg, hsl(${u.avatarHue} 65% 52%), hsl(${(u.avatarHue + 40) % 360} 60% 45%))` }}>{initials(u.name)}</div>
                      <div><p className="font-medium text-gray-900">{u.name}</p><p className="text-xs text-gray-400">{u.email}</p></div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-600 tabular-nums">{formatNumber(u.documentCount || 0)}</td>
                  <td className="px-5 py-3">
                    <select value={u.role} onChange={e => changeRole(u._id, e.target.value)} disabled={self} className="h-8 px-2 rounded-lg border border-gray-200 text-xs bg-white focus:border-brand-500 outline-none disabled:opacity-50">
                      <option value="admin">Admin</option>
                      <option value="municipality_head">Municipality Head</option>
                      <option value="ward_rep">Ward Representative</option>
                      <option value="researcher">Citizen</option>
                    </select>
                  </td>
                  <td className="px-5 py-3">
                    {u.hasCitizenshipDoc ? (
                      <button onClick={() => setViewing(u)} className={cn('inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-md border hover:opacity-80 transition-opacity', v.cls)}>
                        {v.icon && <v.icon className="w-3 h-3" />}{v.label} - View ID
                      </button>
                    ) : (
                      <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-md border', v.cls)}>No document</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className={cn('inline-flex rounded-md px-2 py-1 text-[11px] font-semibold capitalize', u.status === 'suspended' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700')}>{u.status || 'active'}</span>
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-400">{relativeTime(u.createdAt)}</td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-2">
                      <button disabled={self} onClick={() => changeStatus(u._id, u.status === 'suspended' ? 'active' : 'suspended')} className="h-8 rounded-lg border border-gray-200 px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40">
                        {u.status === 'suspended' ? 'Restore' : 'Ban'}
                      </button>
                      <button disabled={self} onClick={() => removeUser(u._id, u.name)} className="h-8 rounded-lg border border-red-100 px-2.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40" aria-label={`Remove ${u.name}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {viewing && <CitizenshipDocModal user={viewing} onClose={() => setViewing(null)} onVerify={setVerification} />}
    </div>
  );
}

function CitizenshipDocModal({ user, onClose, onVerify }) {
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    get(`/api/users/${user._id}/citizenship-doc`).then(d => { setDoc(d); setLoading(false); }).catch(e => { setError(e.message); setLoading(false); });
  }, [user._id]);

  const isPdf = doc?.citizenshipDoc?.startsWith('data:application/pdf');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Identity document - {user.name}</h3>
            <p className="text-xs text-gray-400 mt-0.5">Used to verify this citizen before sensitive account actions.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-50"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5">
          {loading ? (
            <div className="h-40 flex items-center justify-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : error ? (
            <p className="text-sm text-gray-500">{error}</p>
          ) : isPdf ? (
            <a href={doc.citizenshipDoc} target="_blank" rel="noreferrer" className="text-sm text-brand-600 font-medium underline">Open PDF - {doc.citizenshipDocName}</a>
          ) : (
            <img src={doc.citizenshipDoc} alt="Citizenship document" className="w-full rounded-xl border border-gray-100" />
          )}
        </div>
        {!error && (
          <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2 sticky bottom-0 bg-white">
            <button onClick={() => onVerify(user._id, 'rejected')} className="h-9 px-4 rounded-xl border border-red-200 text-red-700 text-xs font-semibold hover:bg-red-50">Reject and ban</button>
            <button onClick={() => onVerify(user._id, 'verified')} className="h-9 px-4 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700">Mark Verified</button>
          </div>
        )}
      </div>
    </div>
  );
}
