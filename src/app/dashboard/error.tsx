'use client';

import { useEffect } from 'react';
import { btn } from '@/lib/ui';

export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-[1440px] items-center px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <section className="max-w-lg rounded-2xl border border-rose-200 bg-white p-6 shadow-sm" role="alert">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-rose-700">Dashboard unavailable</p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-neutral-950">
          We couldn&apos;t load your dashboard.
        </h1>
        <p className="mt-2 text-base text-neutral-600">
          Check your connection, then try again. Your classes and account details have not been changed.
        </p>
        <button type="button" onClick={unstable_retry} className={btn('primary', 'md', 'mt-5')}>
          Try again
        </button>
      </section>
    </main>
  );
}
