'use client';

import { usePathname, useRouter } from 'next/navigation';

/** Program dropdown that filters a table via the ?courseId= URL param. */
export function ProgramFilter({
  programs,
  current,
}: {
  programs: { id: string; title: string }[];
  current?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <label className="flex items-center gap-2 text-sm text-neutral-500">
      Filter
      <select
        value={current ?? ''}
        onChange={(e) => {
          const v = e.target.value;
          router.push(v ? `${pathname}?courseId=${v}` : pathname);
        }}
        className="max-w-[14rem] rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm font-medium text-neutral-800 transition focus:border-neutral-900 focus:outline-none focus:ring-4 focus:ring-neutral-900/10"
      >
        <option value="">All programs</option>
        {programs.map((p) => (
          <option key={p.id} value={p.id}>
            {p.title}
          </option>
        ))}
      </select>
    </label>
  );
}
