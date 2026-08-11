'use client';

import { HIFZ_KIND_LABEL } from '@/lib/quran';
import type { HifzKind, HifzProgress } from '@/lib/types';
import { cn } from '@/lib/ui';

/** Distinct ayahs memorized vs the whole Qur'an, with a thin progress bar. */
export function ProgressMeter({
  progress,
  totalAyahs,
}: {
  progress: HifzProgress;
  totalAyahs: number;
}) {
  const pct = totalAyahs
    ? Math.min(100, (progress.ayahsMemorized / totalAyahs) * 100)
    : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold text-neutral-950">
          {progress.ayahsMemorized.toLocaleString()}
          <span className="font-normal text-neutral-400">
            {' '}
            / {totalAyahs.toLocaleString()} ayahs
          </span>
        </span>
        <span className="text-xs text-neutral-400">
          {progress.surahsTouched} surah{progress.surahsTouched === 1 ? '' : 's'}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-neutral-100">
        <div
          className="h-full rounded-full bg-signal-600 transition-[width]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function KindBadge({ kind }: { kind: HifzKind }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold',
        kind === 'NEW_HIFZ'
          ? 'bg-signal-50 text-signal-700'
          : 'bg-neutral-100 text-neutral-600',
      )}
    >
      {HIFZ_KIND_LABEL[kind]}
    </span>
  );
}

/** 1–5 rating as filled/empty dots; nothing when unrated. */
export function Rating({ value }: { value: number | null }) {
  if (!value) return <span className="text-xs text-neutral-300">—</span>;
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            n <= value ? 'bg-neutral-900' : 'bg-neutral-200',
          )}
        />
      ))}
    </span>
  );
}
