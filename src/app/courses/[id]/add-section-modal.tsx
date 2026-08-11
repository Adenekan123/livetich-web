'use client';

import { useEffect, useRef, useState } from 'react';
import { useActionState } from 'react';
import { addSection, type ActionState } from '@/app/actions/courses';
import { SubmitButton } from '@/components/submit-button';
import { FormError } from '@/components/form-error';
import { btn, inputClass, labelClass } from '@/lib/ui';

const initial: ActionState = { error: null };

/** Owner-only "Add section" button that opens a modal to capture a section
 *  title and an optional description. Closes itself once the section lands. */
export function AddSectionButton({ courseId }: { courseId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(addSection, initial);
  const formRef = useRef<HTMLFormElement>(null);

  // Close + reset once a section is successfully added.
  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      formRef.current?.reset();
    }
  }, [state.ok]);

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
      <button onClick={() => setOpen(true)} className={btn('secondary', 'sm')}>
        + Add section
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
            aria-label="Add section"
            className="my-4 w-full max-w-lg rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl sm:my-8"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-extrabold tracking-tight text-neutral-950">
                Add section
              </h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="grid h-8 w-8 place-items-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900"
              >
                ✕
              </button>
            </div>

            <form ref={formRef} action={action} className="mt-4 space-y-4">
              <FormError message={state.error} />
              <input type="hidden" name="courseId" value={courseId} />

              <div className="space-y-1.5">
                <label htmlFor="section-title" className={labelClass}>
                  Section title
                </label>
                <input
                  id="section-title"
                  name="title"
                  required
                  placeholder="e.g. Tajweed rules of Noon Sakinah"
                  className={inputClass}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="section-description" className={labelClass}>
                  Description <span className="font-normal text-neutral-400">(optional)</span>
                </label>
                <textarea
                  id="section-description"
                  name="description"
                  rows={3}
                  placeholder="What does this section cover?"
                  className={`${inputClass} resize-none`}
                />
              </div>

              <SubmitButton className="w-full" pendingLabel="Adding…">
                Add section
              </SubmitButton>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
