'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PiCheckBold } from 'react-icons/pi';
import { setPluginEnabled } from '@/app/actions/org';
import { cardClass, cn } from '@/lib/ui';
import type { PluginInfo } from '@/lib/types';

export function AddOnsList({ plugins }: { plugins: PluginInfo[] }) {
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function toggle(p: PluginInfo) {
    setError(null);
    setBusyKey(p.key);
    start(async () => {
      const res = await setPluginEnabled(p.key, !p.enabled);
      setBusyKey(null);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  if (plugins.length === 0) {
    return (
      <p className="mt-6 rounded-xl border border-dashed border-neutral-300 bg-neutral-50/50 px-5 py-6 text-sm text-neutral-500">
        No add-ons are available yet.
      </p>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {plugins.map((p) => {
        const busy = pending && busyKey === p.key;
        return (
          <div key={p.key} className={cn(cardClass, 'p-5 sm:p-6')}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-neutral-900">
                    {p.name}
                  </h2>
                  {p.enabled && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                      <PiCheckBold className="h-3 w-3" /> On
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-neutral-500">{p.summary}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={p.enabled}
                aria-label={`${p.enabled ? 'Disable' : 'Enable'} ${p.name}`}
                onClick={() => toggle(p)}
                disabled={busy}
                className={cn(
                  'relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50',
                  p.enabled ? 'bg-neutral-900' : 'bg-neutral-200',
                )}
              >
                <span
                  className={cn(
                    'inline-block h-5 w-5 transform rounded-full bg-white shadow transition',
                    p.enabled ? 'translate-x-[22px]' : 'translate-x-0.5',
                  )}
                />
              </button>
            </div>

            <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">
              {p.features.map((f) => (
                <li
                  key={f}
                  className="flex items-start gap-2 text-sm text-neutral-600"
                >
                  <PiCheckBold className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-400" />
                  {f}
                </li>
              ))}
            </ul>

            <p className="mt-4 text-xs font-medium text-neutral-400">
              {p.priceMonthly === null
                ? 'Free during the pilot'
                : `$${p.priceMonthly}/month after the pilot`}
            </p>
          </div>
        );
      })}
    </div>
  );
}
