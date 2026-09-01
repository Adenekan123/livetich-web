'use client';

import { useState, useTransition } from 'react';
import { deleteCourse } from '@/app/actions/courses';
import { btn, cn, inputClass } from '@/lib/ui';

/**
 * Admin-only "delete program" control. Deletion is irreversible and cascades to
 * every session, enrolment, quiz, assessment and certificate, so it's gated
 * behind a modal that only enables Delete once the admin retypes the exact
 * program title.
 */
export function DangerZone({
  courseId,
  title,
  isBatch,
}: {
  courseId: string;
  title: string;
  isBatch: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const noun = isBatch ? 'batch' : 'program';
  const match = confirm.trim() === title.trim();

  function remove() {
    if (!match) return;
    setError(null);
    start(async () => {
      // On success the action redirects to /courses and never returns.
      const res = await deleteCourse(courseId);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <section className="mt-10 rounded-2xl border border-rose-200 bg-rose-50/40 p-5 sm:p-6">
      <h2 className="font-display text-lg font-bold tracking-tight text-rose-700">
        Danger zone
      </h2>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-sm text-neutral-600">
          Permanently delete this {noun} and all of its data — sessions,
          enrolments, coursework, assessments and certificates. This cannot be
          undone.
        </p>
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setConfirm('');
            setError(null);
          }}
          className={cn(btn('secondary', 'md'), 'border-rose-300 text-rose-700 hover:bg-rose-100')}
        >
          Delete {noun}
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/50 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget && !pending) setOpen(false);
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label={`Delete ${noun}`}
            className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl"
          >
            <h3 className="font-display text-xl font-extrabold tracking-tight text-neutral-950">
              Delete this {noun}?
            </h3>
            <p className="mt-2 text-sm text-neutral-600">
              This permanently removes <strong>{title}</strong> and everything
              under it. To confirm, type the {noun} name exactly:
            </p>
            <p className="mt-3 rounded-lg bg-neutral-100 px-3 py-2 font-mono text-sm text-neutral-800">
              {title}
            </p>
            <input
              autoFocus
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Type the name to confirm"
              className={cn(inputClass, 'mt-3')}
            />
            {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className={btn('ghost', 'sm')}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={remove}
                disabled={!match || pending}
                className={cn(
                  btn('primary', 'sm'),
                  'bg-rose-600 shadow-rose-600/20 hover:bg-rose-500 focus-visible:ring-rose-500',
                )}
              >
                {pending ? 'Deleting…' : `Delete ${noun}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
