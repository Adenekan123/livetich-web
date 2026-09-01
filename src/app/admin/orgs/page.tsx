import Link from 'next/link';
import { adminApi } from '@/lib/admin-api';
import { cardClass, cn } from '@/lib/ui';
import type { AdminOrg } from '@/lib/types';

export const dynamic = 'force-dynamic';

const nf = new Intl.NumberFormat('en-US');
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

export default async function AdminOrgsPage() {
  const orgs = await adminApi<AdminOrg[]>('/admin/orgs');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-neutral-950">
          Organizations
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          {nf.format(orgs.length)} tenants on the platform.
        </p>
      </div>

      <div className={cn(cardClass, 'overflow-hidden')}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-[11px] font-bold uppercase tracking-wide text-neutral-500">
                <th className="px-4 py-3">Organization</th>
                <th className="px-4 py-3 text-right">Users</th>
                <th className="px-4 py-3 text-right">Courses</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Users list</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((o) => (
                <tr
                  key={o.id}
                  className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/60"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-neutral-900">{o.name}</div>
                    <div className="text-xs text-neutral-400">{o.slug}</div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-neutral-700">
                    {nf.format(o.users)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-neutral-700">
                    {nf.format(o.courses)}
                  </td>
                  <td className="px-4 py-3 text-neutral-500">
                    {fmtDate(o.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/users?orgId=${o.id}`}
                      className="text-sm font-semibold text-signal-700 hover:text-signal-800"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
              {orgs.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-12 text-center text-sm text-neutral-400"
                  >
                    No organizations yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
