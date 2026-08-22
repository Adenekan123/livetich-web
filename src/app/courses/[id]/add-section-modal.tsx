'use client';

import { useEffect, useRef, useState } from 'react';
import { useActionState } from 'react';
import {
  addSection,
  importSectionsFromToc,
  type ActionState,
} from '@/app/actions/courses';
import { SubmitButton } from '@/components/submit-button';
import { FormError } from '@/components/form-error';
import { btn, cn, inputClass, labelClass } from '@/lib/ui';

const initial: ActionState = { error: null };

/** Owner-only "Add section" button that opens a modal to capture a section
 *  title and an optional description. Closes itself once the section lands. */
export function AddSectionButton({ courseId }: { courseId: string }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'single' | 'toc'>('single');
  const [state, action] = useActionState(addSection, initial);
  const [tocState, tocAction] = useActionState(importSectionsFromToc, initial);
  const formRef = useRef<HTMLFormElement>(null);

  // Close + reset once a section (or a whole TOC) is successfully added. The
  // close is deferred a tick so it isn't a synchronous setState in the effect.
  useEffect(() => {
    if (!state.ok && !tocState.ok) return;
    const t = setTimeout(() => {
      setOpen(false);
      formRef.current?.reset();
    }, 0);
    return () => clearTimeout(t);
  }, [state.ok, tocState.ok]);

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

            <div className="mt-4 flex gap-1 rounded-lg bg-neutral-100 p-1">
              {(['single', 'toc'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={cn(
                    'flex-1 rounded-md px-3 py-1.5 text-sm font-semibold transition',
                    mode === m
                      ? 'bg-white text-neutral-900 shadow-sm'
                      : 'text-neutral-500 hover:text-neutral-800',
                  )}
                >
                  {m === 'single' ? 'Single section' : 'From table of contents'}
                </button>
              ))}
            </div>

            {mode === 'single' ? (
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
            ) : (
            <form action={tocAction} className="mt-4 space-y-4">
              <FormError message={tocState.error} />
              <input type="hidden" name="courseId" value={courseId} />
              <div className="space-y-1.5">
                <label htmlFor="section-toc" className={labelClass}>
                  Table of contents
                </label>
                <textarea
                  id="section-toc"
                  name="toc"
                  required
                  rows={8}
                  placeholder={
                    'Paste your document’s table of contents — one heading per line, e.g.\n\n1. Introduction to Tajweed\n2. Rules of Noon Sakinah\n3. Rules of Meem Sakinah'
                  }
                  className={`${inputClass} resize-none font-mono text-xs`}
                />
                <p className="text-xs text-neutral-400">
                  Numbering, bullets and page numbers are stripped
                  automatically. Creates up to 50 sections in order.
                </p>
              </div>
              <SubmitButton className="w-full" pendingLabel="Importing…">
                Import sections
              </SubmitButton>
            </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
