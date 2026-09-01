'use client';
import { useEffect, useMemo, useState } from 'react';
import { del, get, patch } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { formatNumber, relativeTime, initials, cn } from '@/lib/format';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Search, ShieldCheck, ShieldAlert, ShieldQuestion, X, Loader2, Trash2 } from 'lucide-react';
import Pagination from '@/components/Pagination';

const VERIFICATION_STYLE = {
  verified: { label: 'Verified', icon: ShieldCheck, cls: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  pending: { label: 'Pending review', icon: ShieldQuestion, cls: 'bg-amber-50 text-amber-700 border-amber-100' },
  rejected: { label: 'Rejected', icon: ShieldAlert, cls: 'bg-red-50 text-red-700 border-red-100' },
  'n/a': { label: '-', icon: null, cls: 'bg-gray-50 text-gray-400 border-gray-100' },
};

const ROLE_OPTIONS = [
  ['all', 'All roles'], ['admin', 'Admin'], ['municipality_head', 'Municipality Head'], ['ward_rep', 'Ward Representative'], ['researcher', 'Citizen'],
];

export default function UsersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [identityFilter, setIdentityFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const mergeUser = (updated) => {
    setUsers(prev => prev.map(u => u._id === updated._id ? { ...u, ...updated, documentCount: u.documentCount } : u));
    setViewing(v => v && v._id === updated._id ? { ...v, ...updated } : v);
  };

  useEffect(() => {
    if (user?.role !== 'admin') {
      router.push('/dashboard');
      return;
    }

    get('/api/users')
      .then(d => {
        setUsers(d.users || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user, router]);

  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, statusFilter, identityFilter, limit]);

  const filtered = useMemo(() => users.filter((u) => {
    const q = search.trim().toLowerCase();

    if (
      q &&
      ![u.name, u.email, u.organization, u.jobTitle]
        .some(v => String(v || '').toLowerCase().includes(q))
    ) {
      return false;
    }

    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (statusFilter !== 'all' && (u.status || 'active') !== statusFilter) return false;
    if (identityFilter !== 'all' && (u.verificationStatus || 'n/a') !== identityFilter) return false;

    return true;
  }), [users, search, roleFilter, statusFilter, identityFilter]);

  const pagedUsers = filtered.slice((page - 1) * limit, page * limit);

  const changeRole = async (id, role) => {
    try {
      const { user: updated } = await patch(`/api/users/${id}`, { role });
      mergeUser(updated);
      toast.success('Role updated');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const changeStatus = async (id, status) => {
    try {
      const { user: updated } = await patch(`/api/users/${id}`, { status });
      mergeUser(updated);

      toast.success(
        status === 'suspended'
          ? 'User deactivated'
          : 'User activated'
      );
    } catch (e) {
      toast.error(e.message);
    }
  };

  const removeUser = async (id, name) => {
    if (!window.confirm(`Remove ${name}? This cannot be undone.`)) return;

    try {
      await del(`/api/users/${id}`);
      setUsers(prev => prev.filter(u => u._id !== id));
      toast.success('User removed');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const setVerification = async (id, verificationStatus) => {
    try {
      const { user: updated } = await patch(`/api/users/${id}`, {
        verificationStatus
      });

      mergeUser(updated);

      toast.success(
        verificationStatus === 'verified'
          ? 'Identity verified'
          : 'Rejected and deactivated'
      );
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">

      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          User Management
        </h1>
      </div>

      <div className="grid gap-2 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm md:grid-cols-[1fr_160px_150px_170px]">

        <label className="flex h-10 items-center gap-2 rounded-lg border border-gray-200 px-3 text-sm text-gray-500">
          <Search className="h-4 w-4" />

          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search users..."
            className="w-full bg-transparent outline-none"
          />
        </label>

        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          className="h-10 rounded-lg border border-gray-200 px-3 text-sm"
        >
          <option value="all">All roles</option>

          {ROLE_OPTIONS
            .filter(([v]) => v !== 'all')
            .map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
        </select>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="h-10 rounded-lg border border-gray-200 px-3 text-sm"
        >
          <option value="all">All status</option>
          <option value="active">Active</option>
          <option value="suspended">Deactivated</option>
        </select>

        <select
          value={identityFilter}
          onChange={e => setIdentityFilter(e.target.value)}
          className="h-10 rounded-lg border border-gray-200 px-3 text-sm"
        >
          <option value="all">All identity</option>
          <option value="verified">Verified</option>
          <option value="pending">Pending</option>
          <option value="rejected">Rejected</option>
          <option value="n/a">No document</option>
        </select>

      </div>

      <div className="hidden overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm lg:block">

        <table className="w-full min-w-[980px] text-sm">

          <thead>
            <tr className="border-b border-gray-100 text-[10px] uppercase tracking-wider text-gray-400">

              <th className="px-5 py-3 text-left font-semibold">
                User
              </th>

              <th className="px-5 py-3 text-left font-semibold">
                Docs
              </th>

              <th className="px-5 py-3 text-left font-semibold">
                Role
              </th>

              <th className="px-5 py-3 text-left font-semibold">
                Identity
              </th>

              <th className="px-5 py-3 text-left font-semibold">
                Status
              </th>

              <th className="px-5 py-3 text-left font-semibold">
                Joined
              </th>

              <th className="px-5 py-3 text-right font-semibold">
                Actions
              </th>

            </tr>
          </thead>

          <tbody className="divide-y divide-gray-50">

            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={7} className="px-5 py-4">
                      <div className="shimmer h-4 rounded w-full" />
                    </td>
                  </tr>
                ))
              : pagedUsers.map(u => (
                  <UserRow
                    key={u._id}
                    u={u}
                    currentUser={user}
                    onRole={changeRole}
                    onStatus={changeStatus}
                    onRemove={removeUser}
                    onView={setViewing}
                  />
                ))}
          </tbody>

        </table>

      </div>

      <div className="grid gap-3 lg:hidden">

        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="shimmer h-40 rounded-2xl"
              />
            ))
          : pagedUsers.map(u => (
              <UserCard
                key={u._id}
                u={u}
                currentUser={user}
                onRole={changeRole}
                onStatus={changeStatus}
                onRemove={removeUser}
                onView={setViewing}
              />
            ))}

      </div>

      {!loading && filtered.length === 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center text-sm text-gray-500">
          No users found. Try adjusting search or filters.
        </div>
      )}

      <Pagination
        page={page}
        limit={limit}
        total={filtered.length}
        onPageChange={setPage}
        onLimitChange={setLimit}
        pageSizeOptions={[20, 50, 100]}
        label="users"
      />

      {viewing && (
        <CitizenshipDocModal
          user={viewing}
          onClose={() => setViewing(null)}
          onVerify={setVerification}
        />
      )}

    </div>
  );
}

function RoleSelect({ value, disabled, onChange }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-sm outline-none disabled:opacity-50"
    >
      {ROLE_OPTIONS
        .filter(([v]) => v !== 'all')
        .map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
    </select>
  );
}

function IdentityButton({ u, onView }) {
  const v =
    VERIFICATION_STYLE[u.verificationStatus] ||
    VERIFICATION_STYLE['n/a'];

  return u.hasCitizenshipDoc ? (
    <button
      onClick={() => onView(u)}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold transition-opacity hover:opacity-80',
        v.cls
      )}
    >
      {v.icon && <v.icon className="h-3 w-3" />}
      {v.label} - View ID
    </button>
  ) : (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold',
        v.cls
      )}
    >
      No document
    </span>
  );
}

function StatusPill({ status }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-md px-2 py-1 text-[11px] font-semibold capitalize',
        status === 'suspended'
          ? 'bg-red-50 text-red-700'
          : 'bg-emerald-50 text-emerald-700'
      )}
    >
      {status === 'suspended'
        ? 'Deactivated'
        : 'Active'}
    </span>
  );
}

function UserAvatar({ u }) {
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
      style={{
        background: `linear-gradient(135deg, hsl(${u.avatarHue} 65% 52%), hsl(${(u.avatarHue + 40) % 360} 60% 45%))`
      }}
    >
      {initials(u.name)}
    </div>
  );
}

function UserRow({
  u,
  currentUser,
  onRole,
  onStatus,
  onRemove,
  onView
}) {
  const self = u._id === currentUser._id;

  return (
    <tr className="hover:bg-gray-50/60">

      <td className="px-5 py-3">
        <div className="flex items-center gap-2.5">

          <UserAvatar u={u} />

          <div>
            <p className="font-medium text-gray-900">
              {u.name}
            </p>

            <p className="text-xs text-gray-400">
              {u.email}
            </p>
          </div>

        </div>
      </td>

      <td className="px-5 py-3 text-gray-600 tabular-nums">
        {formatNumber(u.documentCount || 0)}
      </td>

      <td className="px-5 py-3">
        <RoleSelect
          value={u.role}
          disabled={self}
          onChange={role => onRole(u._id, role)}
        />
      </td>

      <td className="px-5 py-3">
        <IdentityButton
          u={u}
          onView={onView}
        />
      </td>

      <td className="px-5 py-3">
        <StatusPill status={u.status} />
      </td>

      <td className="px-5 py-3 text-xs text-gray-400">
        {relativeTime(u.createdAt)}
      </td>

      <td className="px-5 py-3">
        <Actions
          u={u}
          self={self}
          onStatus={onStatus}
          onRemove={onRemove}
        />
      </td>

    </tr>
  );
}

function UserCard({
  u,
  currentUser,
  onRole,
  onStatus,
  onRemove,
  onView
}) {
  const self = u._id === currentUser._id;

  return (
    <article className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">

      <div className="flex items-start gap-3">

        <UserAvatar u={u} />

        <div className="min-w-0 flex-1">

          <h3 className="truncate text-sm font-semibold text-gray-900">
            {u.name}
          </h3>

          <p className="truncate text-xs text-gray-500">
            {u.email}
          </p>

        </div>

        <StatusPill status={u.status} />

      </div>

      <div className="mt-4 grid gap-3 text-sm">

        <label className="grid gap-1">

          <span className="text-xs font-medium text-gray-500">
            Role
          </span>

          <RoleSelect
            value={u.role}
            disabled={self}
            onChange={role => onRole(u._id, role)}
          />

        </label>

        <div>

          <p className="mb-1 text-xs font-medium text-gray-500">
            Identity
          </p>

          <IdentityButton
            u={u}
            onView={onView}
          />

        </div>

        <div className="flex items-center justify-between text-xs text-gray-500">

          <span>
            Docs: {formatNumber(u.documentCount || 0)}
          </span>

          <span>
            Joined {relativeTime(u.createdAt)}
          </span>

        </div>

        <Actions
          u={u}
          self={self}
          onStatus={onStatus}
          onRemove={onRemove}
        />

      </div>

    </article>
  );
}

function Actions({
  u,
  self,
  onStatus,
  onRemove
}) {
  return (
    <div className="flex justify-end gap-2">

      <button
        disabled={self}
        onClick={() =>
          onStatus(
            u._id,
            u.status === 'suspended'
              ? 'active'
              : 'suspended'
          )
        }
        className="h-9 rounded-lg border border-gray-200 px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
      >
        {u.status === 'suspended'
          ? 'Activate'
          : 'Deactivate'}
      </button>

      <button
        disabled={self}
        onClick={() => onRemove(u._id, u.name)}
        className="grid h-9 w-9 place-items-center rounded-lg border border-red-100 text-red-700 hover:bg-red-50 disabled:opacity-40"
        aria-label={`Remove ${u.name}`}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>

    </div>
  );
}

function CitizenshipDocModal({
  user,
  onClose,
  onVerify
}) {
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    get(`/api/users/${user._id}/citizenship-doc`)
      .then(d => {
        setDoc(d);
        setLoading(false);
      })
      .catch(e => {
        setError(e.message);
        setLoading(false);
      });
  }, [user._id]);

  const isPdf =
    doc?.citizenshipDoc?.startsWith(
      'data:application/pdf'
    );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >

      <div
        onClick={e => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl"
      >

        <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">

          <div>

            <h3 className="text-sm font-semibold text-gray-900">
              Identity document - {user.name}
            </h3>

            <p className="mt-0.5 text-xs text-gray-400">
              Used to verify this citizen before sensitive account actions.
            </p>

          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-50"
          >
            <X className="h-4 w-4" />
          </button>

        </div>

        <div className="p-5">

          {loading ? (
            <div className="flex h-40 items-center justify-center text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : error ? (
            <p className="text-sm text-gray-500">
              {error}
            </p>
          ) : isPdf ? (
            <a
              href={doc.citizenshipDoc}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-brand-600 underline"
            >
              Open PDF - {doc.citizenshipDocName}
            </a>
          ) : (
            <img
              src={doc.citizenshipDoc}
              alt="Citizenship document"
              className="w-full rounded-xl border border-gray-100"
            />
          )}

        </div>

        {!error && (
          <div className="sticky bottom-0 flex justify-end gap-2 border-t border-gray-100 bg-white px-5 py-4">

            <button
              onClick={() =>
                onVerify(user._id, 'rejected')
              }
              className="h-9 rounded-xl border border-red-200 px-4 text-xs font-semibold text-red-700 hover:bg-red-50"
            >
              Reject and deactivate
            </button>

            <button
              onClick={() =>
                onVerify(user._id, 'verified')
              }
              className="h-9 rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              Mark Verified
            </button>

          </div>
        )}

      </div>

    </div>
  );
}