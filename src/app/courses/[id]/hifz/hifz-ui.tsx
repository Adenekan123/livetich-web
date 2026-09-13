'use client';

import { HIFZ_KIND_LABEL } from '@/lib/quran';
import type { HifzKind } from '@/lib/types';
import { cn } from '@/lib/ui';

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
            n <= value ? 'bg-signal-600' : 'bg-neutral-200',
          )}
        />
      ))}
    </span>
  );
}
