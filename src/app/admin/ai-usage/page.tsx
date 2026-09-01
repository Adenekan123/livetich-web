import Link from 'next/link';
import { adminApi } from '@/lib/admin-api';
import { cardClass, cn } from '@/lib/ui';
import type { AiUsageResult } from '@/lib/types';

export const dynamic = 'force-dynamic';

const nf = new Intl.NumberFormat('en-US');
const usd = (n: number) =>
  n < 1 ? `$${n.toFixed(n < 0.01 ? 4 : 3)}` : `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

const FEATURE_LABEL: Record<string, string> = {
  CODING_REVIEW: 'Coding review',
  ASSESSMENT_DRAFT: 'Assessment drafting',
};

const PRESETS = [
  { days: 7, label: '7d' },
  { days: 30, label: '30d' },
  { days: 90, label: '90d' },
];

export default async function AdminAiUsagePage(props: {
  searchParams: Promise<{ days?: string }>;
}) {
  const sp = await props.searchParams;
  const days = [7, 30, 90].includes(Number(sp.days)) ? Number(sp.days) : 30;

  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  const data = await adminApi<AiUsageResult>(
    `/admin/ai-usage?from=${from.toISOString()}&to=${to.toISOString()}`,
  );

  const maxDaily = Math.max(1e-9, ...data.daily.map((d) => d.costUsd));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-neutral-950">
            AI usage
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Token consumption and estimated cost across all AI features.
          </p>
        </div>
        <div className="flex gap-1 rounded-full border border-neutral-200 bg-white p-1">
          {PRESETS.map((p) => (
            <Link
              key={p.days}
              href={`/admin/ai-usage?days=${p.days}`}
              className={cn(
                'rounded-full px-3 py-1.5 text-sm font-semibold transition',
                days === p.days
                  ? 'bg-signal-700 text-white'
                  : 'text-neutral-500 hover:text-neutral-800',
              )}
            >
              {p.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className={cn(cardClass, 'p-5')}>
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Estimated cost
          </div>
          <div className="mt-2 font-display text-3xl font-extrabold text-neutral-950">
            {usd(data.totals.costUsd)}
          </div>
        </div>
        <div className={cn(cardClass, 'p-5')}>
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Calls
          </div>
          <div className="mt-2 font-display text-3xl font-extrabold text-neutral-950">
            {nf.format(data.totals.calls)}
          </div>
        </div>
        <div className={cn(cardClass, 'p-5')}>
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Total tokens
          </div>
          <div className="mt-2 font-display text-3xl font-extrabold text-neutral-950">
            {nf.format(data.totals.totalTokens)}
          </div>
        </div>
        <div className={cn(cardClass, 'p-5')}>
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            In / out tokens
          </div>
          <div className="mt-2 font-display text-xl font-extrabold text-neutral-950">
            {nf.format(data.totals.promptTokens)}
            <span className="text-neutral-400"> / </span>
            {nf.format(data.totals.outputTokens)}
          </div>
        </div>
      </div>

      {/* Daily trend */}
      <div className={cn(cardClass, 'p-6')}>
        <h2 className="font-display text-lg font-bold text-neutral-950">
          Daily cost
        </h2>
        {data.daily.length === 0 ? (
          <p className="mt-6 text-sm text-neutral-400">
            No AI calls in this period yet.
          </p>
        ) : (
          <div className="mt-6 flex h-40 items-end gap-1">
            {data.daily.map((d) => (
              <div
                key={d.day}
                className="group flex flex-1 flex-col items-center justify-end"
                title={`${d.day}: ${usd(d.costUsd)} · ${nf.format(d.tokens)} tokens · ${d.calls} calls`}
              >
                <div
                  className="w-full rounded-t bg-signal-500/80 transition group-hover:bg-signal-600"
                  style={{
                    height: `${Math.max(2, (d.costUsd / maxDaily) * 100)}%`,
                  }}
                />
                <div className="mt-1 hidden text-[9px] text-neutral-400 sm:block">
                  {d.day.slice(5)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Breakdowns */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Breakdown
          title="By feature"
          rows={data.byFeature.map((r) => ({
            label: FEATURE_LABEL[r.feature] ?? r.feature,
            calls: r.calls,
            costUsd: r.costUsd,
            tokens: r.tokens,
          }))}
        />
        <Breakdown
          title="By model"
          rows={data.byModel.map((r) => ({
            label: r.model,
            calls: r.calls,
            costUsd: r.costUsd,
            tokens: r.tokens,
          }))}
        />
      </div>

      <Breakdown
        title="By organization"
        rows={data.byOrg.map((r) => ({
          label: r.orgName,
          calls: r.calls,
          costUsd: r.costUsd,
          tokens: r.tokens,
        }))}
      />

      <p className="text-xs text-neutral-400">
        Costs are estimates derived from a per-model rate table (configurable via
        the AI_PRICE_TABLE env), not billed amounts.
      </p>
    </div>
  );
}

function Breakdown({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; calls: number; costUsd: number; tokens: number }[];
}) {
  return (
    <div className={cn(cardClass, 'overflow-hidden')}>
      <div className="border-b border-neutral-200 px-5 py-3">
        <h2 className="font-display text-base font-bold text-neutral-950">
          {title}
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="border-b border-neutral-100 text-left text-[11px] font-bold uppercase tracking-wide text-neutral-500">
              <th className="px-5 py-2">Name</th>
              <th className="px-5 py-2 text-right">Calls</th>
              <th className="px-5 py-2 text-right">Tokens</th>
              <th className="px-5 py-2 text-right">Cost</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b border-neutral-50 last:border-0">
                <td className="px-5 py-2.5 font-medium text-neutral-800">
                  {r.label}
                </td>
                <td className="px-5 py-2.5 text-right tabular-nums text-neutral-600">
                  {nf.format(r.calls)}
                </td>
                <td className="px-5 py-2.5 text-right tabular-nums text-neutral-600">
                  {nf.format(r.tokens)}
                </td>
                <td className="px-5 py-2.5 text-right font-semibold tabular-nums text-neutral-900">
                  {usd(r.costUsd)}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-sm text-neutral-400">
                  No data in this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
