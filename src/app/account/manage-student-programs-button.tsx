'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  addStudentToCourse,
  removeStudentFromCourse,
} from '@/app/actions/courses';
import { btn, cn } from '@/lib/ui';

/** Per-student "Manage programs" button + modal: enroll/remove across programs. */
export function ManageStudentProgramsButton({
  student,
  programs,
  enrolledCourseIds,
}: {
  student: { id: string; name: string };
  programs: { id: string; title: string }[];
  enrolledCourseIds: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [enrolled, setEnrolled] = useState<Set<string>>(
    () => new Set(enrolledCourseIds),
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  async function toggle(courseId: string, add: boolean) {
    setBusy(courseId);
    if (add) await addStudentToCourse(courseId, student.id);
    else await removeStudentFromCourse(courseId, student.id);
    setEnrolled((prev) => {
      const next = new Set(prev);
      if (add) next.add(courseId);
      else next.delete(courseId);
      return next;
    });
    router.refresh();
    setBusy(null);
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className={btn('secondary', 'sm')}>
        Manage programs
      </button>

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
            aria-label={`Manage programs for ${student.name}`}
            className="my-4 w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl sm:my-8"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-extrabold tracking-tight text-neutral-950">
                  Programs
                </h2>
                <p className="text-sm text-neutral-500">for {student.name}</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="grid h-8 w-8 place-items-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900"
              >
                ✕
              </button>
            </div>

            {programs.length === 0 ? (
              <p className="mt-6 text-sm text-neutral-500">No programs yet.</p>
            ) : (
              <ul className="mt-5 max-h-80 space-y-2 overflow-y-auto">
                {programs.map((p) => {
                  const isIn = enrolled.has(p.id);
                  return (
                    <li
                      key={p.id}
                      className="flex items-center gap-3 rounded-xl border border-neutral-200 px-3 py-2.5"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-900">
                        {p.title}
                      </span>
                      <button
                        onClick={() => toggle(p.id, !isIn)}
                        disabled={busy === p.id}
                        className={cn(
                          isIn ? btn('ghost', 'sm') : btn('primary', 'sm'),
                          isIn && 'text-rose-600 hover:bg-rose-50',
                          'shrink-0',
                        )}
                      >
                        {busy === p.id ? '…' : isIn ? 'Remove' : 'Add'}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
