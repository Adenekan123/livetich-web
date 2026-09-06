'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { PiArrowsClockwiseBold } from 'react-icons/pi';
import { cn } from '@/lib/ui';

/**
 * Re-fetch the current route's server data in place — no full-page reload.
 * `router.refresh()` re-runs the server components and their `api()` calls
 * (all `cache: 'no-store'`, so always fresh) while keeping client state and
 * scroll position. `useTransition` gives us a pending flag to spin the icon.
 *
 * Two shapes:
 *  - default: a compact icon-only pill (fits alongside header chips).
 *  - `label`: a pill with text, for emptier toolbars where the affordance
 *    should be spelled out.
 */
export function RefreshButton({
  label,
  className,
  title = 'Refresh',
}: {
  label?: string;
  className?: string;
  title?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const refresh = () => startTransition(() => router.refresh());

  return (
    <button
      type="button"
      onClick={refresh}
      disabled={pending}
      aria-label={title}
      title={title}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white font-semibold text-neutral-600 transition',
        'hover:border-neutral-300 hover:text-neutral-900 disabled:opacity-60',
        label ? 'px-3 py-1.5 text-[16px]' : 'h-9 w-9 justify-center',
        className,
      )}
    >
      <PiArrowsClockwiseBold
        className={cn('h-4 w-4 shrink-0', pending && 'animate-spin')}
        aria-hidden
      />
      {label && <span>{pending ? 'Refreshing…' : label}</span>}
    </button>
  );
}
