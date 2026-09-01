import Link from 'next/link';
import { redirect } from 'next/navigation';
import { adminApi } from '@/lib/admin-api';
import { getCurrentUser } from '@/lib/auth';
import { cardClass, cn, inputClass } from '@/lib/ui';
import type { AdminUsersResult, Role } from '@/lib/types';
import { UserActions } from './user-actions';

export const dynamic = 'force-dynamic';

const nf = new Intl.NumberFormat('en-US');

function roleBadge(role: Role) {
  const map: Record<Role, string> = {
    ORG_ADMIN: 'bg-signal-100 text-signal-800',
    INSTRUCTOR: 'bg-accent-100 text-accent-700',
    STUDENT: 'bg-neutral-100 text-neutral-600',
  };
  const label =
    role === 'ORG_ADMIN' ? 'Org admin' : role.charAt(0) + role.slice(1).toLowerCase();
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-xs font-semibold',
        map[role],
      )}
    >
      {label}
    </span>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default async function AdminUsersPage(props: {
  searchParams: Promise<{
    q?: string;
    role?: string;
    status?: string;
    orgId?: string;
    page?: string;
  }>;
}) {
  const me = await getCurrentUser();
  if (!me) redirect('/login');
  const sp = await props.searchParams;
  const page = Math.max(1, Number(sp.page) || 1);

  const qs = new URLSearchParams();
  if (sp.q) qs.set('q', sp.q);
  if (sp.role) qs.set('role', sp.role);
  if (sp.status) qs.set('status', sp.status);
  if (sp.orgId) qs.set('orgId', sp.orgId);
  qs.set('page', String(page));
  qs.set('pageSize', '25');

  const data = await adminApi<AdminUsersResult>(
    `/admin/users?${qs.toString()}`,
  );
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));

  // Preserve filters when building a page link.
  const pageHref = (p: number) => {
    const q = new URLSearchParams();
    if (sp.q) q.set('q', sp.q);
    if (sp.role) q.set('role', sp.role);
    if (sp.status) q.set('status', sp.status);
    if (sp.orgId) q.set('orgId', sp.orgId);
    q.set('page', String(p));
    return `/admin/users?${q.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-neutral-950">
          Users
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          {nf.format(data.total)} across all organizations.
        </p>
      </div>

      {/* Filters (plain GET form — no client JS needed) */}
      <form
        method="get"
        className={cn(cardClass, 'flex flex-wrap items-end gap-3 p-4')}
      >
        {sp.orgId && <input type="hidden" name="orgId" value={sp.orgId} />}
        <div className="min-w-[220px] flex-1">
          <label className="mb-1 block text-xs font-medium text-neutral-600">
            Search
          </label>
          <input
            name="q"
            defaultValue={sp.q ?? ''}
            placeholder="Name or email…"
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">
            Role
          </label>
          <select name="role" defaultValue={sp.role ?? ''} className={inputClass}>
            <option value="">All</option>
            <option value="STUDENT">Student</option>
            <option value="INSTRUCTOR">Instructor</option>
            <option value="ORG_ADMIN">Org admin</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">
            Status
          </label>
          <select
            name="status"
            defaultValue={sp.status ?? ''}
            className={inputClass}
          >
            <option value="">All</option>
            <option value="ACTIVE">Active</option>
            <option value="DISABLED">Disabled</option>
          </select>
        </div>
        <button
          type="submit"
          className="rounded-full bg-signal-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-signal-800"
        >
          Apply
        </button>
        {(sp.q || sp.role || sp.status || sp.orgId) && (
          <Link
            href="/admin/users"
            className="px-3 py-2.5 text-sm font-medium text-neutral-500 hover:text-neutral-800"
          >
            Clear
          </Link>
        )}
      </form>

      <div className={cn(cardClass, 'overflow-hidden')}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-[11px] font-bold uppercase tracking-wide text-neutral-500">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Organization</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/60"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 font-medium text-neutral-900">
                      {u.name}
                      {u.isSuperAdmin && (
                        <span className="rounded bg-signal-700 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                          Admin
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-neutral-500">{u.email}</div>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {u.organization?.name ?? (
                      <span className="text-neutral-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{roleBadge(u.role)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 text-xs font-semibold',
                        u.status === 'ACTIVE'
                          ? 'text-emerald-700'
                          : 'text-rose-600',
                      )}
                    >
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          u.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-rose-500',
                        )}
                      />
                      {u.status === 'ACTIVE' ? 'Active' : 'Disabled'}
                      {!u.emailVerified && (
                        <span
                          className="ml-1 text-amber-600"
                          title="Email not verified"
                        >
                          · unverified
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-500">
                    {fmtDate(u.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <UserActions user={u} isSelf={u.id === me.sub} />
                  </td>
                </tr>
              ))}
              {data.rows.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-sm text-neutral-400"
                  >
                    No users match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-neutral-200 px-4 py-3 text-sm">
            <span className="text-neutral-500">
              Page {data.page} of {pages}
            </span>
            <div className="flex gap-2">
              <PageLink href={pageHref(page - 1)} disabled={page <= 1}>
                ← Prev
              </PageLink>
              <PageLink href={pageHref(page + 1)} disabled={page >= pages}>
                Next →
              </PageLink>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PageLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="rounded-full border border-neutral-200 px-3 py-1.5 text-neutral-300">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="rounded-full border border-neutral-300 px-3 py-1.5 font-medium text-neutral-700 transition hover:border-signal-600 hover:text-signal-700"
    >
      {children}
    </Link>
  );
}
