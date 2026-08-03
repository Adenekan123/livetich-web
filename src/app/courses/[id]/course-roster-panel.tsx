'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  addStudentToCourse,
  issueCertificateFor,
  removeStudentFromCourse,
} from '@/app/actions/courses';
import { avatarColor, btn, cardClass, cn, initials, inputClass } from '@/lib/ui';
import type { OrgMember } from '@/lib/types';

export interface RosterRow {
  id: string;
  student: { id: string; name: string; email: string };
}

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
    <path d="m20 20-3.2-3.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

/** Admin roster: read-only summary on the page + a searchable manage modal. */
export function CourseRosterPanel({
  courseId,
  enrolled,
  allStudents,
  certifiedIds,
}: {
  courseId: string;
  enrolled: RosterRow[];
  allStudents: OrgMember[];
  certifiedIds: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(
    () => new Set(enrolled.map((r) => r.student.id)),
  );
  const [certified, setCertified] = useState<Set<string>>(
    () => new Set(certifiedIds),
  );
  const [certifying, setCertifying] = useState<string | null>(null);
  const [certError, setCertError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? allStudents.filter(
          (s) =>
            s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q),
        )
      : allStudents;
    // Enrolled first, then alphabetical.
    return [...list].sort((a, b) => {
      const ae = enrolledIds.has(a.id) ? 0 : 1;
      const be = enrolledIds.has(b.id) ? 0 : 1;
      return ae - be || a.name.localeCompare(b.name);
    });
  }, [allStudents, query, enrolledIds]);

  async function toggle(studentId: string, add: boolean) {
    setBusy(studentId);
    if (add) await addStudentToCourse(courseId, studentId);
    else await removeStudentFromCourse(courseId, studentId);
    setEnrolledIds((prev) => {
      const next = new Set(prev);
      if (add) next.add(studentId);
      else next.delete(studentId);
      return next;
    });
    router.refresh();
    setBusy(null);
  }

  async function certify(studentId: string) {
    setCertifying(studentId);
    setCertError(null);
    const { error } = await issueCertificateFor(courseId, studentId);
    if (error) {
      setCertError(error);
    } else {
      setCertified((prev) => new Set(prev).add(studentId));
      router.refresh();
    }
    setCertifying(null);
  }

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-neutral-900">
          Roster <span className="font-medium text-neutral-400">{enrolled.length}</span>
        </h2>
        <button onClick={() => setOpen(true)} className={btn('primary', 'sm')}>
          Manage roster
        </button>
      </div>

      {/* Read-only summary */}
      {enrolled.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-neutral-300 bg-neutral-50/50 px-5 py-6 text-sm text-neutral-500">
          No students enrolled yet. Use <span className="font-medium">Manage roster</span> to add some.
        </p>
      ) : (
        <ul className={cn(cardClass, 'mt-3 divide-y divide-neutral-100')}>
          {enrolled.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-3">
              <span
                className={cn(
                  'grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white',
                  avatarColor(r.student.id),
                )}
                aria-hidden
              >
                {initials(r.student.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-neutral-900">
                  {r.student.name}
                </p>
                <p className="truncate text-xs text-neutral-400">{r.student.email}</p>
              </div>
              {certified.has(r.student.id) ? (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  <span aria-hidden>🎓</span> Certified
                </span>
              ) : (
                <button
                  onClick={() => certify(r.student.id)}
                  disabled={certifying === r.student.id}
                  className={cn(btn('ghost', 'sm'), 'shrink-0')}
                >
                  {certifying === r.student.id ? 'Issuing…' : 'Issue certificate'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {certError && (
        <p className="mt-2 text-sm text-rose-600">{certError}</p>
      )}

      {/* Manage modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-neutral-950/40 p-4 backdrop-blur-sm sm:p-8"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Manage roster"
            className="my-4 flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl sm:my-8"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-extrabold tracking-tight text-neutral-950">
                  Manage roster
                </h2>
                <p className="text-sm text-neutral-500">
                  {enrolledIds.size} enrolled of {allStudents.length} students
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="grid h-8 w-8 place-items-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900"
              >
                ✕
              </button>
            </div>

            {/* Search */}
            <div className="relative mt-4">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400">
                <SearchIcon />
              </span>
              {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
              <input
                autoFocus
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search students by name or email…"
                aria-label="Search students"
                className={cn(inputClass, 'pl-10')}
              />
            </div>

            {/* List */}
            <ul className="mt-3 flex-1 space-y-1.5 overflow-y-auto">
              {filtered.length === 0 ? (
                <li className="py-10 text-center text-sm text-neutral-400">
                  {allStudents.length === 0 ? 'No students in your organization yet.' : 'No matches.'}
                </li>
              ) : (
                filtered.map((s) => {
                  const isIn = enrolledIds.has(s.id);
                  return (
                    <li
                      key={s.id}
                      className="flex items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-neutral-50"
                    >
                      <span
                        className={cn(
                          'grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white',
                          avatarColor(s.id),
                        )}
                        aria-hidden
                      >
                        {initials(s.name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-neutral-900">{s.name}</p>
                        <p className="truncate text-xs text-neutral-400">{s.email}</p>
                      </div>
                      <button
                        onClick={() => toggle(s.id, !isIn)}
                        disabled={busy === s.id}
                        className={cn(
                          isIn ? btn('ghost', 'sm') : btn('primary', 'sm'),
                          isIn && 'text-rose-600 hover:bg-rose-50',
                          'shrink-0',
                        )}
                      >
                        {busy === s.id ? '…' : isIn ? 'Remove' : 'Add'}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
