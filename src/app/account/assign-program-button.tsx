'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { assignInstructor } from '@/app/actions/org';
import { btn, cn } from '@/lib/ui';

interface Program {
  id: string;
  title: string;
  instructorId: string | null;
  instructorName: string | null;
}

/** Per-instructor "Assign program" button + modal. One instructor per program. */
export function AssignProgramButton({
  instructor,
  programs,
}: {
  instructor: { id: string; name: string };
  programs: Program[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

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

  async function toggle(courseId: string, assign: boolean) {
    setBusy(courseId);
    await assignInstructor(courseId, assign ? instructor.id : '');
    router.refresh();
    setBusy(null);
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className={btn('secondary', 'sm')}>
        Assign program
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
            aria-label={`Assign programs to ${instructor.name}`}
            className="my-4 w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl sm:my-8"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-extrabold tracking-tight text-neutral-950">
                  Assign programs
                </h2>
                <p className="text-sm text-neutral-500">to {instructor.name}</p>
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
                  const mine = p.instructorId === instructor.id;
                  const takenByOther = p.instructorId && !mine;
                  return (
                    <li
                      key={p.id}
                      className="flex items-center gap-3 rounded-xl border border-neutral-200 px-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-neutral-900">
                          {p.title}
                        </p>
                        {takenByOther && (
                          <p className="truncate text-xs text-neutral-400">
                            Currently: {p.instructorName}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => toggle(p.id, !mine)}
                        disabled={busy === p.id}
                        className={cn(
                          mine ? btn('ghost', 'sm') : btn('primary', 'sm'),
                          mine && 'text-rose-600 hover:bg-rose-50',
                          'shrink-0',
                        )}
                      >
                        {busy === p.id
                          ? '…'
                          : mine
                            ? 'Unassign'
                            : takenByOther
                              ? 'Reassign'
                              : 'Assign'}
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
