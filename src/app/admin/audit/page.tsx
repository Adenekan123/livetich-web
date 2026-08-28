import Link from 'next/link';
import { adminApi } from '@/lib/admin-api';
import { cardClass, cn, inputClass } from '@/lib/ui';
import type { AuditResult } from '@/lib/types';

export const dynamic = 'force-dynamic';

const nf = new Intl.NumberFormat('en-US');

/** Human label + tone for an action slug. */
function actionMeta(action: string): { label: string; tone: string } {
  const map: Record<string, { label: string; tone: string }> = {
    'auth.login.success': { label: 'Login', tone: 'bg-emerald-100 text-emerald-700' },
    'auth.login.failure': { label: 'Login failed', tone: 'bg-rose-100 text-rose-700' },
    'auth.password.reset_request': {
      label: 'Reset requested',
      tone: 'bg-neutral-100 text-neutral-600',
    },
    'org.created': { label: 'Org created', tone: 'bg-signal-100 text-signal-800' },
    'admin.user.status_changed': {
      label: 'Status changed',
      tone: 'bg-amber-100 text-amber-800',
    },
    'admin.user.role_changed': {
      label: 'Role changed',
      tone: 'bg-amber-100 text-amber-800',
    },
    'admin.user.superadmin_changed': {
      label: 'Admin flag',
      tone: 'bg-signal-100 text-signal-800',
    },
    'admin.user.reset_link_sent': {
      label: 'Reset link sent',
      tone: 'bg-neutral-100 text-neutral-600',
    },
    'admin.user.email_verified': {
      label: 'Email verified',
      tone: 'bg-emerald-100 text-emerald-700',
    },
    'admin.user.impersonated': {
      label: 'Impersonated',
      tone: 'bg-rose-100 text-rose-700',
    },
  };
  return map[action] ?? { label: action, tone: 'bg-neutral-100 text-neutral-600' };
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function summarizeMeta(meta: Record<string, unknown> | null): string {
  if (!meta) return '';
  const parts: string[] = [];
  for (const [k, v] of Object.entries(meta)) {
    if (v == null || v === '') continue;
    parts.push(`${k}: ${String(v)}`);
    if (parts.length >= 3) break;
  }
  return parts.join(' · ');
}

export default async function AdminAuditPage(props: {
  searchParams: Promise<{
    action?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  const sp = await props.searchParams;
  const page = Math.max(1, Number(sp.page) || 1);

  const qs = new URLSearchParams();
  if (sp.action) qs.set('action', sp.action);
  if (sp.from) qs.set('from', new Date(sp.from).toISOString());
  if (sp.to) qs.set('to', new Date(`${sp.to}T23:59:59`).toISOString());
  qs.set('page', String(page));
  qs.set('pageSize', '50');

  const data = await adminApi<AuditResult>(`/admin/audit?${qs.toString()}`);
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));

  const pageHref = (p: number) => {
    const q = new URLSearchParams();
    if (sp.action) q.set('action', sp.action);
    if (sp.from) q.set('from', sp.from);
    if (sp.to) q.set('to', sp.to);
    q.set('page', String(p));
    return `/admin/audit?${q.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-neutral-950">
          Audit log
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          {nf.format(data.total)} recorded events. Immutable and append-only.
        </p>
      </div>

      <form
        method="get"
        className={cn(cardClass, 'flex flex-wrap items-end gap-3 p-4')}
      >
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">
            Category
          </label>
          <select name="action" defaultValue={sp.action ?? ''} className={inputClass}>
            <option value="">All</option>
            <option value="auth.">Authentication</option>
            <option value="admin.">Admin actions</option>
            <option value="org.">Organizations</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">
            From
          </label>
          <input
            type="date"
            name="from"
            defaultValue={sp.from ?? ''}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">
            To
          </label>
          <input
            type="date"
            name="to"
            defaultValue={sp.to ?? ''}
            className={inputClass}
          />
        </div>
        <button
          type="submit"
          className="rounded-full bg-signal-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-signal-800"
        >
          Apply
        </button>
        {(sp.action || sp.from || sp.to) && (
          <Link
            href="/admin/audit"
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
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Details</th>
                <th className="px-4 py-3">IP</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => {
                const meta = actionMeta(r.action);
                return (
                  <tr
                    key={r.id}
                    className="border-b border-neutral-100 align-top last:border-0 hover:bg-neutral-50/60"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-neutral-500">
                      {fmtTime(r.at)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2 py-0.5 text-xs font-semibold',
                          meta.tone,
                        )}
                      >
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-700">
                      {r.actorEmail ?? <span className="text-neutral-400">system</span>}
                      {r.actorRole && (
                        <span className="ml-1 text-xs text-neutral-400">
                          ({r.actorRole})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      {r.targetType && (
                        <span className="text-neutral-500">
                          {r.targetType}
                          {r.targetId ? ` ${r.targetId.slice(0, 8)}` : ''}
                        </span>
                      )}
                      {summarizeMeta(r.metadata) && (
                        <div className="mt-0.5 text-xs text-neutral-400">
                          {summarizeMeta(r.metadata)}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-neutral-400">
                      {r.ip ?? '—'}
                    </td>
                  </tr>
                );
              })}
              {data.rows.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-12 text-center text-sm text-neutral-400"
                  >
                    No events match these filters.
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
              {page > 1 ? (
                <Link
                  href={pageHref(page - 1)}
                  className="rounded-full border border-neutral-300 px-3 py-1.5 font-medium text-neutral-700 transition hover:border-signal-600 hover:text-signal-700"
                >
                  ← Prev
                </Link>
              ) : (
                <span className="rounded-full border border-neutral-200 px-3 py-1.5 text-neutral-300">
                  ← Prev
                </span>
              )}
              {page < pages ? (
                <Link
                  href={pageHref(page + 1)}
                  className="rounded-full border border-neutral-300 px-3 py-1.5 font-medium text-neutral-700 transition hover:border-signal-600 hover:text-signal-700"
                >
                  Next →
                </Link>
              ) : (
                <span className="rounded-full border border-neutral-200 px-3 py-1.5 text-neutral-300">
                  Next →
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
