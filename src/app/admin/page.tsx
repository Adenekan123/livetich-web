import Link from 'next/link';
import { adminApi } from '@/lib/admin-api';
import { cardClass, cn } from '@/lib/ui';
import type { AdminOverview } from '@/lib/types';

export const dynamic = 'force-dynamic';

const nf = new Intl.NumberFormat('en-US');
const usd = (n: number) =>
  n < 1
    ? `$${n.toFixed(n < 0.01 ? 4 : 3)}`
    : `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className={cn(cardClass, 'p-5')}>
      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className="mt-2 font-display text-3xl font-extrabold tracking-tight text-neutral-950">
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-neutral-500">{sub}</div>}
    </div>
  );
}

export default async function AdminOverviewPage() {
  const o = await adminApi<AdminOverview>('/admin/overview');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-neutral-950">
          Overview
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Platform-wide health across every organization.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        <Stat label="Organizations" value={nf.format(o.orgs)} />
        <Stat
          label="Users"
          value={nf.format(o.users.total)}
          sub={`${nf.format(o.users.active)} active · ${nf.format(o.users.disabled)} disabled`}
        />
        <Stat label="Instructors" value={nf.format(o.users.instructors)} />
        <Stat label="Students" value={nf.format(o.users.students)} />
        <Stat label="Org admins" value={nf.format(o.users.admins)} />
        <Stat label="Courses" value={nf.format(o.courses)} />
        <Stat
          label="Live now"
          value={nf.format(o.liveSessions)}
          sub="sessions in progress"
        />
        <Stat
          label="Submissions"
          value={nf.format(o.submissions30d)}
          sub="last 30 days"
        />
      </div>

      {/* AI usage highlight */}
      <div className={cn(cardClass, 'p-6')}>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-neutral-950">
            AI model usage
          </h2>
          <Link
            href="/admin/ai-usage"
            className="text-sm font-semibold text-signal-700 hover:text-signal-800"
          >
            View details →
          </Link>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-neutral-200 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Today
            </div>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-6 gap-y-1">
              <span className="font-display text-2xl font-extrabold text-neutral-950">
                {usd(o.ai.today.costUsd)}
              </span>
              <span className="text-sm text-neutral-500">
                {nf.format(o.ai.today.calls)} calls ·{' '}
                {nf.format(o.ai.today.tokens)} tokens
              </span>
            </div>
          </div>
          <div className="rounded-xl border border-neutral-200 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Last 30 days
            </div>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-6 gap-y-1">
              <span className="font-display text-2xl font-extrabold text-neutral-950">
                {usd(o.ai.last30d.costUsd)}
              </span>
              <span className="text-sm text-neutral-500">
                {nf.format(o.ai.last30d.calls)} calls ·{' '}
                {nf.format(o.ai.last30d.tokens)} tokens
              </span>
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs text-neutral-400">
          Costs are estimates from a per-model rate table, not billed figures.
        </p>
      </div>
    </div>
  );
}
