'use client';

import { useActionState, useEffect, useState } from 'react';
import {
  createAssignment,
  type AssignmentActionState,
} from '@/app/actions/assignments';
import { SubmitButton } from '@/components/submit-button';
import { FormError } from '@/components/form-error';
import { btn, inputClass, labelClass } from '@/lib/ui';

const initial: AssignmentActionState = { error: null };

/** Short date+time for the "Next class · …" option label. */
function nextClassDate(scheduledAt: string): string {
  return new Date(scheduledAt).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

type GroupOption = { id: string; name: string; memberCount: number };
type SessionOption = { id: string; label: string; scheduledAt: string };

/** "Add assignment" button that opens the create form in a modal. */
export function AddAssignmentForm({
  courseId,
  groups = [],
  sessions = [],
  nextSessionId = '',
}: {
  courseId: string;
  groups?: GroupOption[];
  sessions?: SessionOption[];
  /** Id of the soonest upcoming session — preselected in the picker. Computed
   *  on the server so the default is deterministic across hydration. */
  nextSessionId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(createAssignment, initial);

  // Close on a successful create (deferred so it's not a synchronous
  // set-state inside the effect body).
  useEffect(() => {
    if (!state.ok) return;
    const t = setTimeout(() => setOpen(false), 0);
    return () => clearTimeout(t);
  }, [state]);

  // Escape to close + lock body scroll while the modal is open.
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

  return (
    <>
      <button onClick={() => setOpen(true)} className={btn('primary', 'sm')}>
        + Add assignment
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
            aria-label="New assignment"
            className="my-4 w-full max-w-lg rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl sm:my-8"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-extrabold tracking-tight text-neutral-950">
                New assignment
              </h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="grid h-8 w-8 place-items-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900"
              >
                ✕
              </button>
            </div>

            <form action={action} className="mt-4">
              <input type="hidden" name="courseId" value={courseId} />
              <FormError message={state.error} />
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label htmlFor="a-title" className={labelClass}>
                    Title
                  </label>
                  <input
                    id="a-title"
                    name="title"
                    required
                    placeholder="Week 1 exercise"
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="a-instructions" className={labelClass}>
                    Instructions
                  </label>
                  <textarea
                    id="a-instructions"
                    name="instructions"
                    rows={3}
                    placeholder="What should students do and submit?"
                    className={`${inputClass} resize-none`}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label htmlFor="a-due" className={labelClass}>
                      Due <span className="text-neutral-400">(optional)</span>
                    </label>
                    <input
                      id="a-due"
                      name="dueAt"
                      type="datetime-local"
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="a-max" className={labelClass}>
                      Max points{' '}
                      <span className="text-neutral-400">(optional)</span>
                    </label>
                    <input
                      id="a-max"
                      name="maxPoints"
                      type="number"
                      min={1}
                      max={1000}
                      placeholder="100"
                      className={inputClass}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {groups.length > 0 && (
                    <div className="space-y-1.5">
                      <label htmlFor="a-group" className={labelClass}>
                        Assign to
                      </label>
                      <select
                        id="a-group"
                        name="groupId"
                        defaultValue=""
                        className={inputClass}
                      >
                        <option value="">Whole class</option>
                        {groups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name} ({g.memberCount})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {sessions.length > 0 && (
                    <div className="space-y-1.5">
                      <label htmlFor="a-session" className={labelClass}>
                        From session{' '}
                        <span className="text-neutral-400">(optional)</span>
                      </label>
                      <select
                        id="a-session"
                        name="sessionId"
                        defaultValue={nextSessionId}
                        className={inputClass}
                      >
                        <option value="">Not tied to a session</option>
                        {sessions.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.id === nextSessionId
                              ? `Next class · ${nextClassDate(s.scheduledAt)}`
                              : s.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <SubmitButton size="sm" pendingLabel="Creating…">
                    Create assignment
                  </SubmitButton>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className={btn('ghost', 'sm')}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
