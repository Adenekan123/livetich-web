'use client';

import { useMemo, useState } from 'react';
import { avatarColor, cn, initials, inputClass } from '@/lib/ui';

export type RosterStudent = {
  id: string;
  createdAt: string;
  reminderAddedAt: string | null;
  student: { id: string; name: string; email: string };
};

type Filter = 'all' | 'reminder' | 'no-reminder';
const PAGE_SIZE = 8;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All students' },
  { value: 'reminder', label: 'Reminder on' },
  { value: 'no-reminder', label: 'Reminder off' },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Owner-only roster as a searchable, filterable, paginated table. All work is
 *  client-side over the already-fetched roster — no extra round trips. */
export function StudentRosterTable({ students }: { students: RosterStudent[] }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter((s) => {
      if (filter === 'reminder' && !s.reminderAddedAt) return false;
      if (filter === 'no-reminder' && s.reminderAddedAt) return false;
      if (!q) return true;
      return (
        s.student.name.toLowerCase().includes(q) ||
        s.student.email.toLowerCase().includes(q)
      );
    });
  }, [students, query, filter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const rows = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  // Reset to the first page whenever the result set changes shape.
  const resetPage = () => setPage(0);

  return (
    <div className="mt-5">
      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            resetPage();
          }}
          placeholder="Search by name or email…"
          className={cn(inputClass, 'sm:max-w-xs')}
          aria-label="Search students"
        />
        <div className="flex gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => {
                setFilter(f.value);
                resetPage();
              }}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-medium transition',
                filter === f.value
                  ? 'border-neutral-950 bg-neutral-950 text-white'
                  : 'border-neutral-300 bg-white text-neutral-600 hover:border-neutral-500',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="mt-4 overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="w-full min-w-[34rem] text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-100 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
              <th className="px-4 py-3 font-semibold">Student</th>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Enrolled</th>
              <th className="px-4 py-3 font-semibold">Reminder</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-neutral-500">
                  No students match your search.
                </td>
              </tr>
            ) : (
              rows.map((s) => (
                <tr key={s.id} className="hover:bg-neutral-50/60">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-semibold text-white ${avatarColor(
                          s.student.id,
                        )}`}
                        aria-hidden
                      >
                        {initials(s.student.name)}
                      </span>
                      <span className="truncate font-medium text-neutral-800">
                        {s.student.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-neutral-500">{s.student.email}</td>
                  <td className="px-4 py-3 text-neutral-500">{formatDate(s.createdAt)}</td>
                  <td className="px-4 py-3">
                    {s.reminderAddedAt ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-signal-50 px-2.5 py-0.5 text-xs font-medium text-signal-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-signal-500" />
                        On
                      </span>
                    ) : (
                      <span className="text-xs text-neutral-400">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer: count + pagination */}
      <div className="mt-3 flex items-center justify-between gap-3 text-sm text-neutral-500">
        <span>
          {filtered.length} {filtered.length === 1 ? 'student' : 'students'}
          {filtered.length !== students.length && ` of ${students.length}`}
        </span>
        {pageCount > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(current - 1)}
              disabled={current === 0}
              className="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-600 transition hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ← Prev
            </button>
            <span className="text-xs text-neutral-400">
              Page {current + 1} / {pageCount}
            </span>
            <button
              onClick={() => setPage(current + 1)}
              disabled={current >= pageCount - 1}
              className="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-600 transition hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
